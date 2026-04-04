    require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const db = require('./db');
const mail = require('./mail');
const schemas = require('./schemas');

const app = express();
const PORT = process.env.PORT || 8080;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());

// Middleware de autenticación
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Middleware para verificar rol admin
const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Permisos insuficientes. Se requiere rol admin' });
  }
  next();
};

// ===== RUTAS DE AUTENTICACIÓN =====

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = schemas.loginSchema.parse(req.body);
    
    const usuario = await db.getUsuarioByEmail(email);
    if (!usuario) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    
    if (!usuario.activo) {
      return res.status(401).json({ error: 'Usuario inactivo. Contacta a administrador' });
    }
    
    const isPasswordValid = await bcrypt.compare(password, usuario.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
    
    res.json({
      message: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
    });
  } catch (error) {
    if (error instanceof schemas.z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requerido' });
    }
    
    const usuario = await db.getUsuarioByEmail(email);
    if (!usuario) {
      return res.json({ message: 'Si el email existe, recibirás instrucciones de recuperación' });
    }
    
    // Generar token de reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    
    await db.updatePasswordReset(email, resetToken, expiresAt);
    await mail.sendPasswordResetEmail(email, resetToken, usuario.nombre);
    
    res.json({ message: 'Instrucciones de recuperación enviadas al email' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = schemas.resetPasswordSchema.parse(req.body);
    
    const usuario = await db.resetPassword(token, newPassword);
    
    if (!usuario) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }
    
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    if (error instanceof schemas.z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS DE ACTIVOS =====

// GET activos (requiere autenticación)
app.get('/api/activos', authenticate, async (req, res) => {
  try {
    const activos = await db.getActivos();
    res.json(activos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST crear activo (admin)
app.post('/api/activos', authenticate, requireAdmin, async (req, res) => {
  try {
    const activoData = schemas.createActivoSchema.parse(req.body);
    
    // Verificar que serie no exista
    const existe = await db.getActivoBySerie(activoData.serie);
    if (existe) {
      return res.status(400).json({ error: 'Activo con esta serie ya existe' });
    }
    
    const activo = await db.createActivo(activoData);
    res.status(201).json({ message: 'Activo creado exitosamente', data: activo });
  } catch (error) {
    if (error instanceof schemas.z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT actualizar activo (admin)
app.put('/api/activos/:serie', authenticate, requireAdmin, async (req, res) => {
  try {
    const { serie } = req.params;
    const activoData = schemas.createActivoSchema.partial().parse(req.body);
    
    const activo = await db.updateActivo(serie, activoData);
    
    if (!activo) {
      return res.status(404).json({ error: 'Activo no encontrado' });
    }
    
    res.json({ message: 'Activo actualizado exitosamente', data: activo });
  } catch (error) {
    if (error instanceof schemas.z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE eliminar activo (admin)
app.delete('/api/activos/:serie', authenticate, requireAdmin, async (req, res) => {
  try {
    const { serie } = req.params;
    
    await db.deleteActivo(serie);
    res.json({ message: 'Activo eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS DE COLABORADORES =====

// GET colaboradores (requiere autenticación)
app.get('/api/colaboradores', authenticate, async (req, res) => {
  try {
    const colaboradores = await db.getColaboradores();
    res.json(colaboradores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST crear colaborador (admin)
app.post('/api/colaboradores', authenticate, requireAdmin, async (req, res) => {
  try {
    const colaboradorData = schemas.createColaboradorSchema.parse(req.body);
    
    // Verificar que RUT no exista
    const existe = await db.getColaboradorByRut(colaboradorData.rut);
    if (existe) {
      return res.status(400).json({ error: 'Colaborador con este RUT ya existe' });
    }
    
    const colaborador = await db.createColaborador(colaboradorData);
    res.status(201).json({ message: 'Colaborador creado exitosamente', data: colaborador });
  } catch (error) {
    if (error instanceof schemas.z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT actualizar colaborador (admin)
app.put('/api/colaboradores/:rut', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rut } = req.params;
    const colaboradorData = schemas.createColaboradorSchema.partial().parse(req.body);
    
    const colaborador = await db.updateColaborador(rut, colaboradorData);
    
    if (!colaborador) {
      return res.status(404).json({ error: 'Colaborador no encontrado' });
    }
    
    res.json({ message: 'Colaborador actualizado exitosamente', data: colaborador });
  } catch (error) {
    if (error instanceof schemas.z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS DE USUARIOS (ADMIN) =====

// GET usuarios (solo admin)
app.get('/api/usuarios', authenticate, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await db.supabase
      .from('usuarios')
      .select('id, email, nombre, rol, activo, created_at')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST crear usuario (solo admin)
app.post('/api/usuarios', authenticate, requireAdmin, async (req, res) => {
  try {
    const userData = schemas.createUsuarioSchema.parse(req.body);
    
    // Verificar que email no exista
    const existe = await db.getUsuarioByEmail(userData.email);
    if (existe) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }
    
    const usuario = await db.createUsuario(
      userData.email,
      userData.nombre,
      userData.password,
      userData.rol
    );
    
    res.status(201).json({
      message: 'Usuario creado exitosamente',
      data: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
    });
  } catch (error) {
    if (error instanceof schemas.z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS DE SALUD =====

app.get('/health', (req, res) => {
  res.json({
    status: 'Backend ejecutándose correctamente ✓',
    timestamp: new Date(),
    version: '1.0.0'
  });
});

// ===== MANEJO DE ERRORES =====

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ===== INICIAR SERVIDOR =====

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║  🚀 Inventario TI Domino's - Backend                      ║
  ║  ✓ Servidor ejecutándose en puerto ${PORT}                  ║
  ║  ✓ Base de datos: Supabase PostgreSQL                    ║
  ║  ✓ Autenticación: JWT con login corporativo              ║
  ║                                                           ║
  ║  Endpoints disponibles:                                   ║
  ║  POST   /api/auth/login                                   ║
  ║  POST   /api/auth/forgot-password                         ║
  ║  POST   /api/auth/reset-password                          ║
  ║  GET    /api/activos                                      ║
  ║  POST   /api/activos (admin)                              ║
  ║  PUT    /api/activos/:serie (admin)                       ║
  ║  DELETE /api/activos/:serie (admin)                       ║
  ║  GET    /api/colaboradores                                ║
  ║  POST   /api/colaboradores (admin)                        ║
  ║  PUT    /api/colaboradores/:rut (admin)                   ║
  ║  GET    /api/usuarios (admin)                             ║
  ║  POST   /api/usuarios (admin)                             ║
  ║  GET    /health                                            ║
  ║                                                           ║
  ║  Documentación: http://localhost:${PORT}/health           ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
