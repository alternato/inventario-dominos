const jwt = require('jsonwebtoken');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
};

const authenticate = (req, res, next) => {
  try {
    const token = req.cookies.authToken || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
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

module.exports = { authenticate, requireAdmin, requireSuperAdmin, COOKIE_OPTIONS };
