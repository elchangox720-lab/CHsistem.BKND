import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new HttpError(401, 'No autenticado');
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Sesión no válida o expirada');
  }

  const user = await User.findById(payload.sub);

  if (!user || !user.active) {
    throw new HttpError(401, 'Sesión no válida');
  }

  req.user = user;
  next();
});

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new HttpError(401, 'No autenticado'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'No tienes permisos para esta acción'));
    }

    return next();
  };
}
