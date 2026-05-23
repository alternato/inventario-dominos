require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/activos',       require('./routes/activos'));
app.use('/api/colaboradores', require('./routes/colaboradores'));
app.use('/api/asignaciones',  require('./routes/asignaciones'));
app.use('/api/usuarios',      require('./routes/usuarios'));
app.use('/api/areas',         require('./routes/areas'));
app.use('/api',               require('./routes/misc'));

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, next) => {
  console.error('Error:', err);
  const message = process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message;
  res.status(err.status || 500).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

module.exports = app;
