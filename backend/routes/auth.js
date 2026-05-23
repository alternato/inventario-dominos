const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const mail = require('../mail');
const { loginSchema, resetPasswordSchema, validate } = require('../schemas');
const { verifyMsToken } = require('../msValidator');
const { authenticate, COOKIE_OPTIONS } = require('../middleware');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
});

const verifyLimiterLocal = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Demasiadas verificaciones de sesión. Espera un momento.' },
});

function signToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const usuario = await db.getUsuarioByEmail(email);
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    if (!(await bcrypt.compare(password, usuario.password))) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    res.cookie('authToken', signToken(usuario), COOKIE_OPTIONS);
    res.json({ message: 'Login exitoso', usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol } });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Datos inválidos' });
    res.status(500).json({ error: 'Error al procesar login' });
  }
});

router.post('/sso-login', loginLimiter, async (req, res) => {
  try {
    const { email, msToken } = req.body;
    if (!email || !msToken) return res.status(400).json({ error: 'Email y token de Microsoft requeridos' });

    let payload;
    try {
      payload = await verifyMsToken(msToken);
    } catch (err) {
      console.error('SSO token inválido:', err.message);
      return res.status(401).json({ error: 'Token de Microsoft inválido o expirado' });
    }

    const emailVerificado = (payload.preferred_username || payload.email || '').toLowerCase();
    if (emailVerificado !== email.toLowerCase()) return res.status(401).json({ error: 'Email no coincide con el token de Microsoft' });
    if (!emailVerificado.endsWith('@dominospizza.cl')) return res.status(403).json({ error: 'Solo correos @dominospizza.cl permitidos' });

    let usuario = await db.getUsuarioByEmail(emailVerificado);
    if (!usuario) {
      const nombreAzure = payload.name || payload.given_name || emailVerificado.split('@')[0];
      console.log(`[SSO] Auto-provisioning: ${emailVerificado} (${nombreAzure})`);
      usuario = await db.createUsuario({
        email: emailVerificado,
        nombre: nombreAzure,
        password: crypto.randomBytes(32).toString('hex'),
        rol: 'viewer',
      });
    }
    if (!usuario.activo) return res.status(401).json({ error: 'Usuario inactivo. Contacta a administrador' });

    const nombreActualizado = payload.name || payload.given_name || usuario.nombre;
    if (nombreActualizado && nombreActualizado !== usuario.nombre) {
      await db.query('UPDATE usuarios SET nombre = $1, updated_at = NOW() WHERE id = $2', [nombreActualizado, usuario.id]);
      usuario.nombre = nombreActualizado;
    }

    res.cookie('authToken', signToken(usuario), COOKIE_OPTIONS);
    res.json({ message: 'SSO Login exitoso', usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol } });
  } catch (error) {
    console.error('SSO Error:', error);
    res.status(500).json({ error: 'Error al procesar SSO login' });
  }
});

router.get('/verify', verifyLimiterLocal, authenticate, (req, res) => {
  res.json({ usuario: req.user });
});

router.post('/logout', (req, res) => {
  res.clearCookie('authToken', { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
  res.json({ message: 'Sesión cerrada' });
});

router.post('/forgot-password', loginLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });
    const usuario = await db.getUsuarioByEmail(email);
    if (!usuario) return res.json({ message: 'Si el email existe, recibirás instrucciones de recuperación' });
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.updatePasswordReset(email, resetToken, expiresAt);
    await mail.sendPasswordResetEmail(email, resetToken, usuario.nombre);
    res.json({ message: 'Instrucciones de recuperación enviadas al email' });
  } catch {
    res.status(500).json({ error: 'Error al procesar solicitud' });
  }
});

router.post('/reset-password', loginLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token y contraseña requeridos' });
    const usuario = await db.resetPassword(token, newPassword);
    if (!usuario) return res.status(400).json({ error: 'Token inválido o expirado' });
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch {
    res.status(500).json({ error: 'Error al resetear contraseña' });
  }
});

module.exports = router;
