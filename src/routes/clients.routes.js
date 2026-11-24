import { Router } from 'express';
import { z } from 'zod';
import { Client } from '../models/Client.js';
import { Sale } from '../models/Sale.js';
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

const emailSchema = z.union([
  z.literal(''),
  z.string().trim().max(120).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo inválido'),
]);

const createSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es requerido').max(120),
  taxId: z.string().trim().max(30).optional().default(''),
  email: emailSchema.optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  address: z.string().trim().max(250).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
  active: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es requerido').max(120).optional(),
  taxId: z.string().trim().max(30).optional(),
  email: emailSchema.optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(250).optional(),
  notes: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const search = text(req.query.search);
    const active = boolFilter(req.query.active);

    const query = {};

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { name: regex },
        { taxId: regex },
        { email: regex },
        { phone: regex },
      ];
    }

    if (active !== undefined) query.active = active;

    const [items, total] = await Promise.all([
      Client.find(query).sort({ name: 1 }).skip(skip).limit(limit),
      Client.countDocuments(query),
    ]);

    res.json(pageResult(items, total, page, limit));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const client = await Client.findById(req.params.id);

    if (!client) {
      throw new HttpError(404, 'Cliente no encontrado');
    }

    res.json({ client });
  })
);

router.post(
  '/',
  requireRole('admin', 'vendedor'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const client = await Client.create({
      ...req.body,
      email: req.body.email?.toLowerCase() ?? '',
      createdBy: req.user._id,
    });

    res.status(201).json({ client });
  })
);

router.put(
  '/:id',
  requireRole('admin', 'vendedor'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const client = await Client.findById(req.params.id);

    if (!client) {
      throw new HttpError(404, 'Cliente no encontrado');
    }

    Object.assign(client, req.body);

    if (client.email) {
      client.email = client.email.toLowerCase();
    }

    await client.save();
    res.json({ client });
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const client = await Client.findById(req.params.id);

    if (!client) {
      throw new HttpError(404, 'Cliente no encontrado');
    }

    const hasSales = await Sale.exists({ client: client._id });

    if (hasSales) {
      throw new HttpError(
        409,
        'No se puede eliminar: el cliente tiene ventas registradas'
      );
    }

    await client.deleteOne();
    res.json({ message: 'Cliente eliminado' });
  })
);

export default router;
