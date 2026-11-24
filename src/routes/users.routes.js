import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import {
  boolFilter,
  escapeRegex,
  oneOf,
  pageResult,
  parsePagination,
  text,
} from '../utils/queries.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

const ROLE_LABELS = ['admin', 'vendedor', 'inventario'];

const nameSchema = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(80);

const emailSchema = z
  .string()
  .trim()
  .min(1, 'El correo es requerido')
  .max(120)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo inválido');

const passwordSchema = z
  .string()
  .min(6, 'La contraseña debe tener al menos 6 caracteres')
  .max(72);

const createSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(ROLE_LABELS).optional().default('vendedor'),
});

const updateSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  role: z.enum(ROLE_LABELS).optional(),
  active: z.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const search = text(req.query.search);
    const role = oneOf(req.query.role, ROLE_LABELS);
    const active = boolFilter(req.query.active);

    const query = {};

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: regex }, { email: regex }];
    }

    if (role) query.role = role;
    if (active !== undefined) query.active = active;

    const [items, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(query),
    ]);

    res.json(pageResult(items, total, page, limit));
  })
);

router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase();
    const exists = await User.findOne({ email });

    if (exists) {
      throw new HttpError(409, 'Ya existe un usuario con ese correo');
    }

    const user = await User.create({ ...req.body, email });
    res.status(201).json({ user: user.toJSON() });
  })
);

router.put(
  '/:id',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
      throw new HttpError(404, 'Usuario no encontrado');
    }

    const isSelf = user._id.toString() === req.user._id.toString();

    if (isSelf && req.body.active === false) {
      throw new HttpError(400, 'No puedes desactivar tu propio usuario');
    }

    if (isSelf && req.body.role && req.body.role !== 'admin') {
      throw new HttpError(400, 'No puedes cambiar tu propio rol de administrador');
    }

    if (req.body.email) {
      req.body.email = req.body.email.toLowerCase();

      if (req.body.email !== user.email) {
        const exists = await User.findOne({
          email: req.body.email,
          _id: { $ne: user._id },
        });

        if (exists) {
          throw new HttpError(409, 'Ya existe un usuario con ese correo');
        }
      }
    }

    Object.assign(user, req.body);
    await user.save();

    res.json({ user: user.toJSON() });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user._id.toString()) {
      throw new HttpError(400, 'No puedes eliminar tu propio usuario');
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      throw new HttpError(404, 'Usuario no encontrado');
    }

    res.json({ message: 'Usuario eliminado' });
  })
);

export default router;
