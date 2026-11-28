import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import clientsRoutes from './routes/clients.routes.js';
import productsRoutes from './routes/products.routes.js';
import siteRoutes from './routes/site.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import salesRoutes from './routes/sales.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { HttpError } from './utils/httpError.js';

const app = express();
const PORT = process.env.PORT || 3000;

const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  'http://localhost:4200,http://127.0.0.1:4200,https://chsistem.vercel.app'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  return (
    allowedOrigins.includes(origin) ||
    /^https:\/\/chsistem-[a-z0-9-]+\.vercel\.app$/.test(origin)
  );
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
});

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.json({ message: 'CHsistem API funcionando' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    database: dbStates[mongoose.connection.readyState] ?? 'unknown',
  });
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/setup', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/site', siteRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((error, req, res, next) => {
  if (error.message?.startsWith('Origen no permitido por CORS')) {
    return res.status(403).json({ error: error.message });
  }

  if (error instanceof HttpError || error.status) {
    const body = { error: error.message };
    if (error.details !== undefined) {
      body.details = error.details;
    }
    return res.status(error.status).json(body);
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || 'campo';
    return res
      .status(409)
      .json({ error: `Ya existe un registro con ese ${field}` });
  }

  if (error.name === 'ValidationError') {
    const issues = Object.values(error.errors || {}).map(
      (item) => item.message
    );
    return res.status(400).json({ error: 'Datos inválidos', issues });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ error: 'Identificador inválido' });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  console.error(error);
  return res.status(500).json({ error: 'Error interno del servidor' });
});

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no está definida en las variables de entorno');
    }

    await connectDB();

    app.listen(PORT, () => {
      console.log(`Servidor escuchando en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
}

start();
