const jwt = require('jsonwebtoken');
const db = require('./db');
const { ApiError } = require('./lib/apiError');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
};

// Intervalo de limpieza periódica de la denylist de sesiones (Req. 11.5).
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];
    // Token ausente → 401 (Req. 11.1).
    if (!token) return next(ApiError.unauthorized('Token requerido'));

    // Token ausente/inválido/expirado → 401 (Req. 11.1, 11.2).
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next(ApiError.unauthorized('Token inválido o expirado'));
    }

    // Sesión revocada (denylist vigente) → 401 (Req. 11.5).
    if (payload.jti && (await db.sesionRevocada(payload.jti))) {
      return next(ApiError.unauthorized('Sesión revocada'));
    }

    req.user = payload;
    next();
  } catch (err) {
    // Cualquier fallo inesperado (p.ej. de la BD) se delega al manejador central.
    next(err);
  }
};

// Limpieza periódica de entradas vencidas de `sesiones_revocadas` (Req. 11.5).
// La expiración natural del JWT deja obsoletas esas filas; se eliminan para
// que la tabla no crezca sin límite. Devuelve el temporizador para poder
// detenerlo en pruebas o apagado ordenado; `unref()` evita bloquear el proceso.
const iniciarLimpiezaSesiones = (intervalMs = CLEANUP_INTERVAL_MS) => {
  const timer = setInterval(() => {
    db.limpiarSesionesRevocadas().catch((err) => {
      console.error('Error al limpiar sesiones revocadas:', err.message);
    });
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
};

const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'admin' && req.user.rol !== 'superadministrador') {
    return res.status(403).json({ error: 'Permisos insuficientes. Se requiere rol admin o superadministrador' });
  }
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user.rol !== 'superadministrador') {
    return res.status(403).json({ error: 'Permisos insuficientes. Se requiere rol superadministrador' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireSuperAdmin, COOKIE_OPTIONS, iniciarLimpiezaSesiones };
