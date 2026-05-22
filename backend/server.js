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
const { ejecutarAgente } = require('./agent');

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

// ===== RUTAS DE ÁREAS (CONFIGURACIÓN) =====

app.get('/api/areas', authenticate, async (req, res) => {
  try {
    const areas = await db.getAreas();
    res.json(areas);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener áreas' });
  }
});

app.post('/api/areas', authenticate, requireAdmin, async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre de área requerido' });
    const area = await db.createArea(nombre);
    res.status(201).json(area);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El área ya existe' });
    res.status(500).json({ error: 'Error al crear área' });
  }
});

app.put('/api/areas/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    const area = await db.updateArea(parseInt(id), nombre);
    res.json(area);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar área' });
  }
});

app.delete('/api/areas/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteArea(parseInt(id));
    res.json({ message: 'Área eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar área' });
  }
});

// ===== RUTAS DE ASIGNACIONES =====

// Listar asignaciones (con filtros opcionales: ?estado=activa&serie=XXX&rut=YYY)
app.get('/api/asignaciones', authenticate, async (req, res) => {
  try {
    const { estado, serie, rut, limit = 100 } = req.query;
    let query = `
      SELECT a.*, 
             c.nombre AS colaborador_nombre, c.correo AS colaborador_correo, c.area AS colaborador_area,
             act.marca, act.modelo, act.tipo_dispositivo, act.imei
      FROM asignaciones a
      JOIN colaboradores c ON a.rut_colaborador = c.rut
      JOIN activos act ON a.serie_activo = act.serie
      WHERE 1=1
    `;
    const params = [];
    if (estado) { params.push(estado); query += ` AND a.estado = $${params.length}`; }
    if (serie)  { params.push(serie);  query += ` AND a.serie_activo = $${params.length}`; }
    if (rut)    { params.push(rut);    query += ` AND a.rut_colaborador = $${params.length}`; }
    query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    const { rows } = await db.pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('getAsignaciones:', error);
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

// Historial de asignaciones de un activo
app.get('/api/activos/:serie/asignaciones', authenticate, async (req, res) => {
  try {
    const { serie } = req.params;
    const { rows } = await db.pool.query(`
      SELECT a.*,
             c.nombre AS colaborador_nombre, c.correo AS colaborador_correo, c.area AS colaborador_area
      FROM asignaciones a
      JOIN colaboradores c ON a.rut_colaborador = c.rut
      WHERE a.serie_activo = $1
      ORDER BY a.created_at DESC
    `, [serie]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial de asignaciones' });
  }
});

// Historial de asignaciones de un colaborador
app.get('/api/colaboradores/:rut/asignaciones', authenticate, async (req, res) => {
  try {
    const { rut } = req.params;
    const { rows } = await db.pool.query(`
      SELECT a.*,
             act.marca, act.modelo, act.tipo_dispositivo, act.serie, act.imei
      FROM asignaciones a
      JOIN activos act ON a.serie_activo = act.serie
      WHERE a.rut_colaborador = $1
      ORDER BY a.created_at DESC
    `, [rut]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial del colaborador' });
  }
});

// Crear asignación → guarda en DB, actualiza activo, envía email a RRHH
app.post('/api/asignaciones', authenticate, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { serie_activo, rut_colaborador, entregado_por, notas } = req.body;
    if (!serie_activo || !rut_colaborador) {
      return res.status(400).json({ error: 'serie_activo y rut_colaborador son requeridos' });
    }

    await client.query('BEGIN');

    // Verificar que no haya asignación activa para este activo
    const { rows: activas } = await client.query(
      `SELECT id FROM asignaciones WHERE serie_activo = $1 AND estado = 'activa'`, [serie_activo]
    );
    if (activas.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Este equipo ya tiene una asignación activa' });
    }

    // Obtener datos del activo y colaborador para el email
    const { rows: [activo] } = await client.query('SELECT * FROM activos WHERE serie = $1', [serie_activo]);
    const { rows: [colaborador] } = await client.query('SELECT * FROM colaboradores WHERE rut = $1', [rut_colaborador]);
    if (!activo || !colaborador) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Activo o colaborador no encontrado' });
    }

    // Crear asignación
    const { rows: [asignacion] } = await client.query(`
      INSERT INTO asignaciones (serie_activo, rut_colaborador, entregado_por, notas, usuario_id, estado)
      VALUES ($1, $2, $3, $4, $5, 'activa')
      RETURNING *
    `, [serie_activo, rut_colaborador, entregado_por || null, notas || null, req.user.id]);

    // Actualizar activo → asignado
    await client.query(`
      UPDATE activos SET rut_responsable = $1, estado = 'Asignado', updated_at = NOW()
      WHERE serie = $2
    `, [rut_colaborador, serie_activo]);

    // Historial
    await client.query(`
      INSERT INTO historial_activos (serie, rut_anterior, rut_nuevo, estado_anterior, estado_nuevo, tipo_movimiento, notas, usuario_id)
      VALUES ($1, NULL, $2, $3, 'Asignado', 'asignacion', $4, $5)
    `, [serie_activo, rut_colaborador, activo.estado, notas || null, req.user.id]);

    await client.query('COMMIT');

    // Enviar email a RRHH (sin bloquear la respuesta)
    mail.sendMailAsignacion({
      colaborador,
      activo,
      entregadoPor: entregado_por || req.user.nombre,
      fecha: new Date(),
    }).catch(err => console.error('[mail] Error enviando email asignación:', err.message));

    res.status(201).json({ data: asignacion, message: 'Asignación creada exitosamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('crearAsignacion:', error);
    res.status(500).json({ error: 'Error al crear la asignación' });
  } finally {
    client.release();
  }
});

// Cerrar asignación (devolución) → actualiza DB, envía email de confirmación al colaborador
app.put('/api/asignaciones/:id/cerrar', authenticate, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { motivo_devolucion, estado_fisico_devolucion, desvincular_colaborador, correo_alterno } = req.body;
    const nuevoEstado = estado_fisico_devolucion || 'Disponible';

    await client.query('BEGIN');

    // Obtener asignación
    const { rows: [asignacion] } = await client.query(
      `SELECT a.*, c.nombre AS colab_nombre, c.correo AS colab_correo, c.area AS colab_area,
              act.marca, act.modelo, act.tipo_dispositivo, act.imei, act.serie
       FROM asignaciones a
       JOIN colaboradores c ON a.rut_colaborador = c.rut
       JOIN activos act ON a.serie_activo = act.serie
       WHERE a.id = $1 AND a.estado = 'activa'`, [id]
    );
    if (!asignacion) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Asignación activa no encontrada' });
    }

    // Determinar email destino y generar token
    const emailDestino = asignacion.colab_correo || correo_alterno || null;
    let tokenConfirmacion = null;
    let tokenExpiraAt = null;
    let estadoAsignacion = 'cerrada';

    if (emailDestino) {
      tokenConfirmacion = require('crypto').randomBytes(32).toString('hex');
      tokenExpiraAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      estadoAsignacion = 'pendiente_firma';
    }

    // Actualizar asignación
    const { rows: [asignacionCerrada] } = await client.query(`
      UPDATE asignaciones SET
        fecha_fin = NOW(),
        motivo_devolucion = $1,
        estado_fisico_devolucion = $2,
        desvincular_colaborador = $3,
        token_confirmacion = $4,
        token_expira_at = $5,
        estado = $6
      WHERE id = $7
      RETURNING *
    `, [motivo_devolucion || null, nuevoEstado, !!desvincular_colaborador,
        tokenConfirmacion, tokenExpiraAt, estadoAsignacion, id]);

    // Actualizar activo
    await client.query(`
      UPDATE activos SET rut_responsable = NULL, estado = $1, updated_at = NOW()
      WHERE serie = $2
    `, [nuevoEstado, asignacion.serie_activo]);

    // Historial
    await client.query(`
      INSERT INTO historial_activos (serie, rut_anterior, rut_nuevo, estado_anterior, estado_nuevo, tipo_movimiento, notas, usuario_id)
      VALUES ($1, $2, NULL, 'Asignado', $3, 'devolucion', $4, $5)
    `, [asignacion.serie_activo, asignacion.rut_colaborador, nuevoEstado, motivo_devolucion || null, req.user.id]);

    // Desvincular colaborador si corresponde
    if (desvincular_colaborador) {
      await client.query(
        `UPDATE colaboradores SET activo = false, updated_at = NOW() WHERE rut = $1`,
        [asignacion.rut_colaborador]
      );
    }

    await client.query('COMMIT');

    // Enviar email de confirmación (sin bloquear)
    if (emailDestino && tokenConfirmacion) {
      const colaboradorInfo = {
        nombre: asignacion.colab_nombre,
        rut: asignacion.rut_colaborador,
        area: asignacion.colab_area,
      };
      const activoInfo = {
        marca: asignacion.marca,
        modelo: asignacion.modelo,
        tipo_dispositivo: asignacion.tipo_dispositivo,
        serie: asignacion.serie_activo,
        imei: asignacion.imei,
      };
      mail.sendMailConfirmacionDevolucion({
        colaborador: colaboradorInfo,
        activo: activoInfo,
        token: tokenConfirmacion,
        emailDestino,
        viaPersonal: !asignacion.colab_correo && !!correo_alterno,
      }).catch(err => console.error('[mail] Error enviando email confirmación:', err.message));
    }

    res.json({ data: asignacionCerrada, message: 'Devolución registrada exitosamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('cerrarAsignacion:', error);
    res.status(500).json({ error: 'Error al registrar la devolución' });
  } finally {
    client.release();
  }
});

// Confirmar devolución desde link del email (ruta pública)
app.get('/api/asignaciones/confirmar/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { rows: [asignacion] } = await db.pool.query(
      `SELECT a.*, c.nombre AS colab_nombre, act.marca, act.modelo
       FROM asignaciones a
       JOIN colaboradores c ON a.rut_colaborador = c.rut
       JOIN activos act ON a.serie_activo = act.serie
       WHERE a.token_confirmacion = $1`, [token]
    );

    if (!asignacion) {
      return res.status(404).send(`
        <html><body style="font-family:Arial;text-align:center;padding:60px;background:#fef2f2">
          <h2 style="color:#dc2626">❌ Link inválido</h2>
          <p>Este enlace no existe o ya fue utilizado.</p>
        </body></html>
      `);
    }

    if (asignacion.token_expira_at && new Date() > new Date(asignacion.token_expira_at)) {
      return res.status(410).send(`
        <html><body style="font-family:Arial;text-align:center;padding:60px;background:#fff7ed">
          <h2 style="color:#f97316">⏱ Link expirado</h2>
          <p>Este enlace de confirmación ya expiró (válido 72 horas).</p>
          <p>Contacta al Departamento de TI para reenviar el enlace.</p>
        </body></html>
      `);
    }

    // Marcar como confirmada
    await db.pool.query(`
      UPDATE asignaciones SET
        confirmado_at = NOW(),
        estado = 'cerrada',
        token_confirmacion = NULL
      WHERE token_confirmacion = $1
    `, [token]);

    res.send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f0fdf4">
        <div style="max-width:500px;margin:0 auto;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);border-top:5px solid #22c55e">
          <h2 style="color:#16a34a">✅ Devolución confirmada</h2>
          <p style="color:#475569">Hola <strong>${asignacion.colab_nombre}</strong>,</p>
          <p style="color:#475569">Hemos registrado tu confirmación de devolución del equipo:</p>
          <p style="background:#f8fafc;padding:12px;border-radius:8px;font-weight:bold;color:#1e293b">
            ${asignacion.marca} ${asignacion.modelo}
          </p>
          <p style="font-size:13px;color:#94a3b8;margin-top:30px">
            © 2026 Domino's Pizza Chile — Departamento de TI
          </p>
        </div>
      </body></html>
    `);
  } catch (error) {
    console.error('confirmarDevolucion:', error);
    res.status(500).send('<html><body>Error al procesar la confirmación.</body></html>');
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

// ===== AGENTE IA =====

const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas consultas al agente. Espera un minuto.' },
});

app.post('/api/chat', authenticate, agentLimiter, async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'El agente no está configurado (falta ANTHROPIC_API_KEY).' });
    }

    const { mensajes } = req.body;
    if (!Array.isArray(mensajes) || mensajes.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array "mensajes".' });
    }

    const { respuesta, historial } = await ejecutarAgente(mensajes);
    res.json({ respuesta, historial });
  } catch (err) {
    console.error('Error en agente:', err.message);
    res.status(500).json({ error: 'Error al procesar la solicitud del agente.' });
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