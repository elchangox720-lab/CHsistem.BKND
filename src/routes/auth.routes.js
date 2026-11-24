import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

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

const setupSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
  email: emailSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es requerida'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: passwordSchema,
});

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authPayload(user) {
  return { token: signToken(user), user: user.toJSON() };
}

router.get(
  '/setup-status',
  asyncHandler(async (req, res) => {
    const count = await User.countDocuments();
    res.json({ needsSetup: count === 0 });
  })
);

router.post(
  '/setup',
  validate(setupSchema),
  asyncHandler(async (req, res) => {
    const count = await User.countDocuments();

    if (count > 0) {
      throw new HttpError(409, 'La configuración inicial ya fue completada');
    }

    const user = await User.create({
      name: req.body.name,
      email: req.body.email.toLowerCase(),
      password: req.body.password,
      role: 'admin',
    });

    res.status(201).json(authPayload(user));
  })
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({
      email: req.body.email.toLowerCase(),
    }).select('+password');

    if (!user || !user.active) {
      throw new HttpError(401, 'Correo o contraseña incorrectos');
    }

    const validPassword = await user.comparePassword(req.body.password);

    if (!validPassword) {
      throw new HttpError(401, 'Correo o contraseña incorrectos');
    }

    res.json(authPayload(user));
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user.toJSON() });
  })
);

router.put(
  '/password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      throw new HttpError(404, 'Usuario no encontrado');
    }

    const validPassword = await user.comparePassword(req.body.currentPassword);

    if (!validPassword) {
      throw new HttpError(400, 'La contraseña actual no es correcta');
    }

    user.password = req.body.newPassword;
    await user.save();

    res.json({ message: 'Contraseña actualizada' });
  })
);

export default router;
