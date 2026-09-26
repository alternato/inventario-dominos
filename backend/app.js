require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const logger = require('./lib/logger');
const { ApiError, TIPOS } = require('./lib/apiError');

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

// Ruta no encontrada — mismo contrato de error uniforme (Req. 13.2).
app.use((req, res) => {
  res.status(404).json({
    error: { type: 'NOT_FOUND', message: 'Ruta no encontrada', details: null },
  });
});

// Manejador de errores central — serializa cualquier ApiError (o error genérico)
// a { error: { type, message, details } } (Req. 13.2, 12.3).
// El stack real nunca se expone en la respuesta pública; solo va a lib/logger.js.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Registrar el error real (con stack) mediante el logger, que enmascara
  // automáticamente cualquier clave sensible antes de escribir.
  logger.error('Error no controlado:', err);

  const esApiError = err instanceof ApiError;
  const status = esApiError ? err.status : (err.status || TIPOS.INTERNAL);
  const type = esApiError ? err.type : 'INTERNAL';
  const details = esApiError ? (err.details ?? null) : null;

  // En producción los 500 devuelven un mensaje genérico; nunca se expone el
  // detalle interno ni el stack en la respuesta pública (Req. 12.3).
  let message;
  if (status >= 500) {
    message = process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message;
  } else {
    message = err.message;
  }

  res.status(status).json({ error: { type, message, details } });
});

module.exports = app;
