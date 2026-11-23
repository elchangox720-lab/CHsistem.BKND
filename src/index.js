import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';

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

app.disable('x-powered-by');
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
app.use(express.json());

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

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((error, req, res, next) => {
  if (error.message?.startsWith('Origen no permitido por CORS')) {
    return res.status(403).json({ error: error.message });
  }

  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function start() {
  try {
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
