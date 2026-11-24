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

router.use(authenticate);

const createSchema = z.object({
  sku: z.string().trim().min(1, 'El SKU es requerido').max(40),
  name: z.string().trim().min(2, 'El nombre es requerido').max(120),
  description: z.string().trim().max(500).optional().default(''),
  category: z.string().trim().max(60).optional().default(''),
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
    const active = boolFilter(req.query.active);
    const lowStock = req.query.lowStock === 'true';

    const query = {};

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: regex }, { sku: regex }, { category: regex }];
    }

    if (category) query.category = category;
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
