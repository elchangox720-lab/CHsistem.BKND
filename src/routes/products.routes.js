import { Router } from 'express';
import { z } from 'zod';
import { Product } from '../models/Product.js';
import { Sale } from '../models/Sale.js';
import { StockMovement } from '../models/StockMovement.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import {
  boolFilter,
  escapeRegex,
  pageResult,
  parsePagination,
  text,
} from '../utils/queries.js';

const router = Router();

const specSchema = z.object({
  label: z.string().trim().min(1, 'La característica es requerida').max(60),
  value: z.string().trim().min(1, 'El valor es requerido').max(160),
});

const publicProductFields =
  'sku name description category brand model price specs stock';

router.get(
  '/public',
  asyncHandler(async (req, res) => {
    const search = text(req.query.search);
    const brand = text(req.query.brand);
    const model = text(req.query.model);
    const category = text(req.query.category);
    const query = { active: true };

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { name: regex },
        { sku: regex },
        { description: regex },
        { category: regex },
        { brand: regex },
        { model: regex },
      ];
    }

    if (brand) query.brand = brand;
    if (model) query.model = model;
    if (category) query.category = category;

    const [products, brands, models, categories] = await Promise.all([
      Product.find(query)
        .select(publicProductFields)
        .sort({ brand: 1, model: 1, name: 1 })
        .limit(200)
        .lean(),
      Product.distinct('brand', { active: true, brand: { $nin: ['', null] } }),
      Product.distinct('model', { active: true, model: { $nin: ['', null] } }),
      Product.distinct('category', {
        active: true,
        category: { $nin: ['', null] },
      }),
    ]);

    const cleanList = (values) =>
      values.filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));

    const items = products.map(({ stock, ...product }) => ({
      ...product,
      _id: String(product._id),
      available: stock > 0,
    }));

    res.json({
      items,
      total: items.length,
      brands: cleanList(brands),
      models: cleanList(models),
      categories: cleanList(categories),
    });
  })
);

router.use(authenticate);

const createSchema = z.object({
  sku: z.string().trim().min(1, 'El SKU es requerido').max(40),
  name: z.string().trim().min(2, 'El nombre es requerido').max(120),
  description: z.string().trim().max(500).optional().default(''),
  category: z.string().trim().max(60).optional().default(''),
  brand: z.string().trim().max(80).optional().default(''),
  model: z.string().trim().max(80).optional().default(''),
  specs: z.array(specSchema).max(20).optional().default([]),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  cost: z.coerce.number().min(0).optional().default(0),
  stock: z.coerce.number().int().min(0).optional().default(0),
  minStock: z.coerce.number().int().min(0).optional().default(0),
  active: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  sku: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(2, 'El nombre es requerido').max(120).optional(),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(60).optional(),
  brand: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  specs: z.array(specSchema).max(20).optional(),
  price: z.coerce.number().min(0).optional(),
  cost: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  minStock: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const search = text(req.query.search);
    const category = text(req.query.category);
    const brand = text(req.query.brand);
    const model = text(req.query.model);
    const active = boolFilter(req.query.active);
    const lowStock = req.query.lowStock === 'true';

    const query = {};

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { name: regex },
        { sku: regex },
        { category: regex },
        { brand: regex },
        { model: regex },
      ];
    }

    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (model) query.model = model;
    if (active !== undefined) query.active = active;
    if (lowStock) query.$expr = { $lte: ['$stock', '$minStock'] };

    const [items, total] = await Promise.all([
      Product.find(query).sort({ name: 1 }).skip(skip).limit(limit),
      Product.countDocuments(query),
    ]);

    res.json(pageResult(items, total, page, limit));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
      throw new HttpError(404, 'Producto no encontrado');
    }

    res.json({ product });
  })
);

router.post(
  '/',
  requireRole('admin', 'inventario'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const sku = req.body.sku.toUpperCase();
    const exists = await Product.findOne({ sku });

    if (exists) {
      throw new HttpError(409, 'Ya existe un producto con ese SKU');
    }

    const product = await Product.create({
      ...req.body,
      sku,
      createdBy: req.user._id,
    });

    if (product.stock > 0) {
      await StockMovement.create({
        product: product._id,
        type: 'entrada',
        quantity: product.stock,
        previousStock: 0,
        newStock: product.stock,
        reason: 'Stock inicial',
        user: req.user._id,
      });
    }

    res.status(201).json({ product });
  })
);

router.put(
  '/:id',
  requireRole('admin', 'inventario'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
      throw new HttpError(404, 'Producto no encontrado');
    }

    const previousStock = product.stock;
    const { stock, ...rest } = req.body;
    const sku = rest.sku?.toUpperCase();

    if (sku && sku !== product.sku) {
      const exists = await Product.findOne({
        sku,
        _id: { $ne: product._id },
      });

      if (exists) {
        throw new HttpError(409, 'Ya existe un producto con ese SKU');
      }
    }

    Object.assign(product, rest);

    if (sku) product.sku = sku;
    if (stock !== undefined) product.stock = stock;

    await product.save();

    if (stock !== undefined && product.stock !== previousStock) {
      await StockMovement.create({
        product: product._id,
        type: 'ajuste',
        quantity: product.stock,
        previousStock,
        newStock: product.stock,
        reason: 'Ajuste desde edición de producto',
        user: req.user._id,
      });
    }

    res.json({ product });
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
      throw new HttpError(404, 'Producto no encontrado');
    }

    const hasSales = await Sale.exists({ 'items.product': product._id });

    if (hasSales) {
      throw new HttpError(
        409,
        'No se puede eliminar: el producto tiene ventas registradas'
      );
    }

    await StockMovement.deleteMany({ product: product._id });
    await product.deleteOne();

    res.json({ message: 'Producto eliminado' });
  })
);

export default router;
