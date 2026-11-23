import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';

const app = express();
const PORT = process.env.PORT || 3000;

const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

app.use(cors());
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
