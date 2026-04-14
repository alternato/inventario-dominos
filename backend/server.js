require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

// Configuración de multer (en memoria para procesar directamente)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB
});

const db = require('./db');
const mail = require('./mail');
const {
  loginSchema, resetPasswordSchema,
  createActivoSchema, updateActivoSchema,
  createColaboradorSchema, updateColaboradorSchema,
  createUsuarioSchema, updateUsuarioSchema,
  validate,
} = require('./schemas');
const { verifyMsToken } = require('./msValidator');
const { processImportFile } = require('./importController');

const app = express();
const PORT = process.env.PORT || 8081;

// Confiar en el proxy reverso (Nginx/Apache) — arregla req.ip, cookies secure y rate limiting
app.set('trust proxy', 1);

// ===== RATE LIMITERS =====

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
});

const pinLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5,
  message: { error: 'Demasiados intentos de PIN. Espera 1 minuto.' },
});

// ===== MIDDLEWARE =====

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Deshabilitar caché del navegador para todas las rutas de API
// Esto evita que el browser retorne 304 con datos obsoletos tras un DELETE/POST/PUT
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Middleware de autenticación
const authenticate = (req, res, next) => {
  try {
    const token = req.cookies.authToken || req.headers.authorization?.split(' ')[1];
    
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
  if (req.user.rol !== 'admin' && req.user.rol !== 'superadministrador') {
    return res.status(403).json({ error: 'Permisos insuficientes. Se requiere rol admin o superadministrador' });
  }
  next();
};

// Middleware para verificar rol superadministrador
const requireSuperAdmin = (req, res, next) => {
  if (req.user.rol !== 'superadministrador') {
    return res.status(403).json({ error: 'Permisos insuficientes. Se requiere rol superadministrador' });
  }
  next();
};

// ===== RUTAS DE AUTENTICACIÓN =====

// Login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
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
    
    // Guardar token en httpOnly cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });
    
    res.json({
      message: 'Login exitoso',
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
    });
  } catch (error) {
    // Manejo simple de errores
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos' });
    }
    res.status(500).json({ error: 'Error al procesar login' });
  }
});

// SSO Login (Microsoft Entra ID)
app.post('/api/auth/sso-login', loginLimiter, async (req, res) => {
  try {
    const { email, msToken } = req.body;

    if (!email || !msToken) {
      return res.status(400).json({ error: 'Email y token de Microsoft requeridos' });
    }

    // Validar criptográficamente el id_token contra las JWKs de Azure
    let payload;
    try {
      payload = await verifyMsToken(msToken);
    } catch (verifyErr) {
      console.error('SSO token inválido:', verifyErr.message);
      return res.status(401).json({ error: 'Token de Microsoft inválido o expirado' });
    }

    // El email validado proviene del token, no del body (previene impersonación)
    const emailVerificado = (payload.preferred_username || payload.email || '').toLowerCase();
    if (emailVerificado !== email.toLowerCase()) {
      return res.status(401).json({ error: 'Email no coincide con el token de Microsoft' });
    }
    if (!emailVerificado.endsWith('@dominospizza.cl')) {
      return res.status(403).json({ error: 'Solo correos @dominospizza.cl permitidos' });
    }

    // Auto-provisioning: si el usuario no existe, crearlo como 'viewer'
    let usuario = await db.getUsuarioByEmail(emailVerificado);
    if (!usuario) {
      // El nombre viene del token de Azure AD (campo 'name' o 'given_name')
      const nombreAzure = payload.name || payload.given_name || emailVerificado.split('@')[0];
      console.log(`[SSO] Auto-provisioning nuevo usuario: ${emailVerificado} (${nombreAzure})`);
      usuario = await db.createUsuario({
        email: emailVerificado,
        nombre: nombreAzure,
        password: require('crypto').randomBytes(32).toString('hex'), // Contraseña aleatoria (no usable sin SSO)
        rol: 'viewer'
      });
    }

    if (!usuario.activo) {
      return res.status(401).json({ error: 'Usuario inactivo. Contacta a administrador' });
    }

    // Sincronizar nombre desde Azure AD en cada login (por si cambió en el directorio)
    const nombreActualizado = payload.name || payload.given_name || usuario.nombre;
    if (nombreActualizado && nombreActualizado !== usuario.nombre) {
      await db.query(
        'UPDATE usuarios SET nombre = $1, updated_at = NOW() WHERE id = $2',
        [nombreActualizado, usuario.id]
      );
      usuario.nombre = nombreActualizado;
    }

    // Si Entra ID ya lo validó, emitimos el token
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

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      message: 'SSO Login exitoso',
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
    });
  } catch (error) {
    console.error('SSO Error:', error);
    res.status(500).json({ error: 'Error al procesar SSO login' });
  }
});


// Verificar sesión activa
app.get('/api/auth/verify', authenticate, (req, res) => {
  res.json({ usuario: req.user });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/'
  });
  res.json({ message: 'Sesión cerrada' });
});



// [ELIMINADO] Rutas duplicadas de logout y verify (A3)

// Forgot Password (con rate limiter — A4)
app.post('/api/auth/forgot-password', loginLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requerido' });
    }
    
    const usuario = await db.getUsuarioByEmail(email);
    if (!usuario) {
      return res.json({ message: 'Si el email existe, recibirás instrucciones de recuperación' });
    }
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    await db.updatePasswordReset(email, resetToken, expiresAt);
    await mail.sendPasswordResetEmail(email, resetToken, usuario.nombre);
    
    res.json({ message: 'Instrucciones de recuperación enviadas al email' });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar solicitud' });
  }
});

// Reset Password (con rate limiter — A4)
app.post('/api/auth/reset-password', loginLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token y contraseña requeridos' });
    }
    
    const usuario = await db.resetPassword(token, newPassword);
    
    if (!usuario) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }
    
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al resetear contraseña' });
  }
});

// ===== RUTAS DE ACTIVOS =====

app.get('/api/activos', authenticate, async (req, res) => {
  try {
    const activos = await db.getActivos();
    res.json(activos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener activos' });
  }
});

app.get('/api/activos/:serie', authenticate, async (req, res) => {
  try {
    const { serie } = req.params;
    const activo = await db.getActivoBySerie(serie);
    
    if (!activo) {
      return res.status(404).json({ error: 'Activo no encontrado' });
    }
    
    res.json(activo);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener activo' });
  }
});

app.post('/api/activos', authenticate, validate(createActivoSchema), async (req, res) => {
  try {
    const activo = await db.createActivo(req.body, req.user.id);
    res.status(201).json(activo);
  } catch (error) {
    console.error('createActivo:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un activo con esa serie' });
    res.status(500).json({ error: 'Error al crear activo' });
  }
});

app.put('/api/activos/:serie', authenticate, validate(updateActivoSchema), async (req, res) => {
  try {
    const { serie } = req.params;
    const activo = await db.updateActivo(serie, req.body, req.user.id);
    res.json(activo);
  } catch (error) {
    console.error('updateActivo:', error);
    res.status(500).json({ error: 'Error al actualizar activo' });
  }
});


app.delete('/api/activos/:serie', authenticate, requireAdmin, async (req, res) => {
  try {
    const { serie } = req.params;
    await db.deleteActivo(serie, req.user.id);
    res.json({ message: 'Activo eliminado' });
  } catch (error) {
    console.error('deleteActivo:', error);
    res.status(500).json({ error: 'Error al eliminar activo' });
  }
});

// Importar activos desde archivo (Dry-Run Preview)
app.post('/api/import/preview', authenticate, requireAdmin, async (req, res) => {
  try {
    const rows = req.body.rows;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos para previsualizar' });
    }
    const { previewImportRows } = require('./importController');
    const results = await previewImportRows(rows);
    res.json(results);
  } catch (error) {
    console.error('Error en preview:', error);
    res.status(500).json({ error: 'Error procesando la vista previa: ' + error.message });
  }
});

// Importar activos desde archivo (Confirmar)
app.post('/api/import/commit', authenticate, requireAdmin, async (req, res) => {
  try {
    const rows = req.body.rows;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos para importar' });
    }
    const { processImportRows } = require('./importController');
    const results = await processImportRows(rows, req.user.id);
    res.json({ message: 'Importación completada', ...results });
  } catch (error) {
    console.error('Error importando:', error);
    res.status(500).json({ error: 'Error importando datos: ' + error.message });
  }
});

// ===== RUTAS DE COLABORADORES =====

app.get('/api/colaboradores', authenticate, async (req, res) => {
  try {
    const colaboradores = await db.getColaboradores();
    res.json(colaboradores);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener colaboradores' });
  }
});

app.get('/api/colaboradores/:rut', authenticate, async (req, res) => {
  try {
    const { rut } = req.params;
    const colaborador = await db.getColaboradorByRut(rut);
    
    if (!colaborador) {
      return res.status(404).json({ error: 'Colaborador no encontrado' });
    }
    
    res.json(colaborador);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener colaborador' });
  }
});

app.post('/api/colaboradores', authenticate, validate(createColaboradorSchema), async (req, res) => {
  try {
    const colaborador = await db.createColaborador(req.body);
    res.status(201).json(colaborador);
  } catch (error) {
    console.error('createColaborador:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un colaborador con ese RUT' });
    res.status(500).json({ error: 'Error al crear colaborador' });
  }
});

app.put('/api/colaboradores/:rut', authenticate, validate(updateColaboradorSchema), async (req, res) => {
  try {
    const { rut } = req.params;
    const colaborador = await db.updateColaborador(rut, req.body);
    res.json(colaborador);
  } catch (error) {
    console.error('updateColaborador:', error);
    res.status(500).json({ error: 'Error al actualizar colaborador' });
  }
});

app.delete('/api/colaboradores/:rut', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rut } = req.params;
    await db.deleteColaborador(rut);
    res.json({ message: 'Colaborador eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar colaborador' });
  }
});

app.get('/api/colaboradores/:rut/activos', authenticate, async (req, res) => {
  try {
    const { rut } = req.params;
    const activos = await db.getActivosByColaborador(rut);
    res.json(activos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener activos del colaborador' });
  }
});

// ===== RUTAS DE USUARIOS (SUPERADMIN ONLY) =====

app.get('/api/usuarios', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const usuarios = await db.getUsuarios();
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

app.post('/api/usuarios', authenticate, requireSuperAdmin, validate(createUsuarioSchema), async (req, res) => {
  try {
    const usuario = await db.createUsuario(req.body);
    res.status(201).json(usuario);
  } catch (error) {
    console.error('createUsuario:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.put('/api/usuarios/:id', authenticate, requireSuperAdmin, validate(updateUsuarioSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await db.updateUsuario(parseInt(id), req.body);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(usuario);
  } catch (error) {
    console.error('updateUsuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// ===== HISTORIAL / TRAZABILIDAD =====

app.get('/api/historial', authenticate, async (req, res) => {
  try {
    const { serie, rut, desde, hasta, limit } = req.query;
    const historial = await db.getHistorial({ serie, rut, desde, hasta, limit: limit ? parseInt(limit) : 100 });
    res.json(historial);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

app.get('/api/activos/:serie/historial', authenticate, async (req, res) => {
  try {
    const { serie } = req.params;
    const historial = await db.getHistorial({ serie });
    res.json(historial);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial del activo' });
  }
});

// ===== BÚSQUEDA GLOBAL =====

app.get('/api/buscar', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'El término de búsqueda debe tener al menos 2 caracteres' });
    }
    const resultados = await db.buscarGlobal(q.trim());
    res.json(resultados);
  } catch (error) {
    res.status(500).json({ error: 'Error en búsqueda' });
  }
});

// ===== KPIs PARA DASHBOARD =====

app.get('/api/kpis', authenticate, async (req, res) => {
  try {
    const kpis = await db.getKPIs();
    res.json(kpis);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener KPIs' });
  }
});

// ===== HEALTH CHECK =====

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ===== ERROR HANDLING =====

// ===== EXPORT TEMPORAL (protegido — C2) =====
app.get('/api/export-sql', authenticate, requireSuperAdmin, async (req, res) => {
  const escape = (val) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'number') return val;
    if (val instanceof Date) return `'${val.toISOString()}'`;
    return `'${String(val).replace(/'/g, "''")}'`;
  };
  try {
    let sql = `-- BACKUP IT COMPASS ${new Date().toISOString()}\nSET session_replication_role = replica;\n\n`;
    for (const table of ['usuarios','colaboradores','activos','historial_activos']) {
      const { rows } = await db.pool.query(`SELECT * FROM ${table} ORDER BY id`);
      if (rows.length > 0) {
        const cols = Object.keys(rows[0]).join(', ');
        sql += `-- ${table} (${rows.length} registros)\n`;
        sql += rows.map(r => `INSERT INTO ${table} (${cols}) VALUES (${Object.values(r).map(escape).join(', ')}) ON CONFLICT DO NOTHING;`).join('\n');
        sql += '\n\n';
      }
    }
    sql += 'SET session_replication_role = DEFAULT;\n';
    res.setHeader('Content-Disposition', 'attachment; filename="backup_inventario.sql"');
    res.setHeader('Content-Type', 'text/plain');
    res.send(sql);
  } catch (err) {
    res.status(500).json({ error: 'Error exportando respaldo' });
  }
});

// ===== MIGRACIÓN AUTOMÁTICA (MANTENIMIENTO) =====
app.get('/api/migrate', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    await db.query('ALTER TABLE activos ADD COLUMN IF NOT EXISTS imsi VARCHAR(20);');
    res.json({ message: 'Base de Datos actualizada exitosamente. El campo IMSI ha sido añadido.' });
  } catch (e) {
    console.error('Error en migración:', e);
    res.status(500).json({ error: 'Error al actualizar la base de datos: ' + e.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const message = process.env.NODE_ENV === 'production' 
    ? 'Error interno del servidor'
    : err.message;
  
  const status = err.status || 500;
  
  res.status(status).json({ 
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ===== INICIAR SERVIDOR =====

app.listen(PORT, () => {
  console.log(`✅ Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🔒 CORS configurado para: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`🍪 httpOnly cookies habilitadas`);
});

module.exports = app;