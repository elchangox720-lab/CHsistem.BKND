import { Router } from 'express';
import { z } from 'zod';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import {
  oneOf,
  pageResult,
  parsePagination,
  text,
} from '../utils/queries.js';

const router = Router();

router.use(authenticate);

const MOVEMENT_TYPES = ['entrada', 'salida', 'ajuste'];
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido');

const adjustSchema = z
  .object({
    productId: objectId,
    type: z.enum(MOVEMENT_TYPES),
    quantity: z.coerce.number().int().min(0),
    reason: z.string().trim().max(200).optional().default(''),
  })
  .refine(
    (data) => data.type === 'ajuste' || data.quantity > 0,
    { message: 'La cantidad debe ser mayor que cero', path: ['quantity'] }
  );

router.get(
  '/movements',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const product = text(req.query.product);
    const type = oneOf(req.query.type, MOVEMENT_TYPES);

    if (product && !/^[a-f\d]{24}$/i.test(product)) {
      throw new HttpError(400, 'Producto inválido');
    }

    if (req.query.type && !type) {
      throw new HttpError(400, 'Tipo de movimiento inválido');
    }

    const query = {};
    if (product) query.product = product;
    if (type) query.type = type;

    const [items, total] = await Promise.all([
      StockMovement.find(query)
        .populate('product', 'name sku')
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockMovement.countDocuments(query),
    ]);

    res.json(pageResult(items, total, page, limit));
  })
);

router.post(
  '/adjust',
  requireRole('admin', 'inventario'),
  validate(adjustSchema),
  asyncHandler(async (req, res) => {
    const { productId, type, quantity, reason } = req.body;
    const product = await Product.findById(productId);

    if (!product) {
      throw new HttpError(404, 'Producto no encontrado');
    }

    const previousStock = product.stock;
    let newStock;

    if (type === 'entrada') {
      newStock = previousStock + quantity;
    } else if (type === 'salida') {
      if (quantity > previousStock) {
        throw new HttpError(
          400,
          `Stock insuficiente para ${product.name}. Disponible: ${previousStock}`
        );
      }

      newStock = previousStock - quantity;
    } else {
      newStock = quantity;
    }

    product.stock = newStock;
    await product.save();

    const movement = await StockMovement.create({
      product: product._id,
      type,
      quantity,
      previousStock,
      newStock,
      reason,
      user: req.user._id,
    });

    res.status(201).json({ movement, product });
  })
);

export default router;
