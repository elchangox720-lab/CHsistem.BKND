import { Router } from 'express';
import { z } from 'zod';
import { Client } from '../models/Client.js';
import { Product } from '../models/Product.js';
import { Sale } from '../models/Sale.js';
import { StockMovement } from '../models/StockMovement.js';
import { nextSequence } from '../models/Counter.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import {
  escapeRegex,
  oneOf,
  pageResult,
  parsePagination,
  text,
} from '../utils/queries.js';

const router = Router();

router.use(authenticate);

const SALE_STATUSES = ['pagada', 'pendiente', 'anulada'];
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido');

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const itemSchema = z.object({
  productId: objectId,
  quantity: z.coerce.number().int().min(1, 'La cantidad debe ser mayor que cero'),
  unitPrice: z.coerce.number().min(0, 'El precio no puede ser negativo').optional(),
});

const createSchema = z.object({
  clientId: objectId,
  items: z.array(itemSchema).min(1, 'Agrega al menos un producto'),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  status: z.enum(['pagada', 'pendiente']).optional().default('pagada'),
  notes: z.string().trim().max(500).optional().default(''),
});

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const search = text(req.query.search);
    const status = oneOf(req.query.status, SALE_STATUSES);
    const client = text(req.query.client);
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);

    if (req.query.status && !status) {
      throw new HttpError(400, 'Estado de venta inválido');
    }

    if (client && !/^[a-f\d]{24}$/i.test(client)) {
      throw new HttpError(400, 'Cliente inválido');
    }

    if (req.query.from && !from) {
      throw new HttpError(400, 'Fecha inicial inválida');
    }

    if (req.query.to && !to) {
      throw new HttpError(400, 'Fecha final inválida');
    }

    const query = {};

    if (search) {
      query.invoiceNumber = new RegExp(escapeRegex(search), 'i');
    }

    if (status) query.status = status;
    if (client) query.client = client;

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = from;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const [items, total] = await Promise.all([
      Sale.find(query)
        .populate('client', 'name taxId email')
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Sale.countDocuments(query),
    ]);

    res.json(pageResult(items, total, page, limit));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sale = await Sale.findById(req.params.id)
      .populate('client', 'name taxId email phone address')
      .populate('user', 'name')
      .populate('items.product', 'name sku');

    if (!sale) {
      throw new HttpError(404, 'Venta no encontrada');
    }

    res.json({ sale });
  })
);

router.post(
  '/',
  requireRole('admin', 'vendedor'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const client = await Client.findById(req.body.clientId);

    if (!client || !client.active) {
      throw new HttpError(400, 'Selecciona un cliente activo');
    }

    const merged = new Map();

    for (const item of req.body.items) {
      if (merged.has(item.productId)) {
        throw new HttpError(400, 'No repitas el mismo producto en la venta');
      }

      merged.set(item.productId, { ...item });
    }

    const products = await Product.find({
      _id: { $in: [...merged.keys()] },
    });

    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    );

    const prepared = [];

    for (const [productId, item] of merged) {
      const product = productMap.get(productId);

      if (!product || !product.active) {
        throw new HttpError(400, 'Uno de los productos no está disponible');
      }

      if (item.quantity > product.stock) {
        throw new HttpError(
          400,
          `Stock insuficiente para ${product.name}. Disponible: ${product.stock}`
        );
      }

      const unitPrice = item.unitPrice ?? product.price;

      prepared.push({
        product,
        quantity: item.quantity,
        unitPrice,
        subtotal: round2(item.quantity * unitPrice),
      });
    }

    const subtotal = round2(
      prepared.reduce((sum, item) => sum + item.subtotal, 0)
    );
    const tax = round2(subtotal * (req.body.taxRate / 100));
    const total = round2(subtotal + tax);

    const decremented = [];
    let sale;

    try {
      for (const item of prepared) {
        const updated = await Product.findOneAndUpdate(
          {
            _id: item.product._id,
            active: true,
            stock: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );

        if (!updated) {
          throw new HttpError(
            400,
            `Stock insuficiente para ${item.product.name}`
          );
        }

        decremented.push({
          product: item.product._id,
          quantity: item.quantity,
          previousStock: updated.stock + item.quantity,
          newStock: updated.stock,
        });
      }

      const sequence = await nextSequence('sales');
      const invoiceNumber = `FAC-${String(sequence).padStart(6, '0')}`;

      sale = await Sale.create({
        invoiceNumber,
        client: client._id,
        items: prepared.map((item) => ({
          product: item.product._id,
          name: item.product.name,
          sku: item.product.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
        subtotal,
        taxRate: req.body.taxRate,
        tax,
        total,
        status: req.body.status,
        notes: req.body.notes,
        user: req.user._id,
      });

      await StockMovement.insertMany(
        decremented.map((movement) => ({
          product: movement.product,
          type: 'salida',
          quantity: movement.quantity,
          previousStock: movement.previousStock,
          newStock: movement.newStock,
          reason: `Venta ${invoiceNumber}`,
          sale: sale._id,
          user: req.user._id,
        }))
      );

      await sale.populate([
        { path: 'client', select: 'name taxId email' },
        { path: 'user', select: 'name' },
      ]);

      res.status(201).json({ sale });
    } catch (error) {
      if (sale?._id) {
        await Sale.deleteOne({ _id: sale._id });
      }

      await Promise.all(
        decremented.map((movement) =>
          Product.updateOne(
            { _id: movement.product },
            { $inc: { stock: movement.quantity } }
          )
        )
      );

      throw error;
    }
  })
);

router.patch(
  '/:id/pay',
  requireRole('admin', 'vendedor'),
  asyncHandler(async (req, res) => {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      throw new HttpError(404, 'Venta no encontrada');
    }

    if (sale.status === 'anulada') {
      throw new HttpError(400, 'No se puede cobrar una venta anulada');
    }

    sale.status = 'pagada';
    await sale.save();
    await sale.populate([
      { path: 'client', select: 'name taxId email' },
      { path: 'user', select: 'name' },
    ]);

    res.json({ sale });
  })
);

router.patch(
  '/:id/cancel',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      throw new HttpError(404, 'Venta no encontrada');
    }

    if (sale.status === 'anulada') {
      await sale.populate([
        { path: 'client', select: 'name taxId email' },
        { path: 'user', select: 'name' },
      ]);
      return res.json({ sale });
    }

    const movements = [];

    for (const item of sale.items) {
      const updated = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { new: true }
      );

      if (!updated) continue;

      movements.push({
        product: item.product,
        type: 'entrada',
        quantity: item.quantity,
        previousStock: updated.stock - item.quantity,
        newStock: updated.stock,
        reason: `Anulación ${sale.invoiceNumber}`,
        sale: sale._id,
        user: req.user._id,
      });
    }

    if (movements.length > 0) {
      await StockMovement.insertMany(movements);
    }

    sale.status = 'anulada';
    await sale.save();
    await sale.populate([
      { path: 'client', select: 'name taxId email' },
      { path: 'user', select: 'name' },
    ]);

    return res.json({ sale });
  })
);

export default router;
