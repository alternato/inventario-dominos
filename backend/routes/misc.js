const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authenticate, requireSuperAdmin } = require('../middleware');
const { ejecutarAgente } = require('../agent');

const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas consultas al agente. Espera un minuto.' },
});

// ── KPIs ──────────────────────────────────────────────────────────────────────

router.get('/kpis', authenticate, async (req, res) => {
  try {
    res.json(await db.getKPIs());
  } catch {
    res.status(500).json({ error: 'Error al obtener KPIs' });
  }
});

// ── Búsqueda global ───────────────────────────────────────────────────────────

router.get('/buscar', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'El término de búsqueda debe tener al menos 2 caracteres' });
    }
    res.json(await db.buscarGlobal(q.trim()));
  } catch {
    res.status(500).json({ error: 'Error en búsqueda' });
  }
});

// ── Historial ─────────────────────────────────────────────────────────────────

router.get('/historial', authenticate, async (req, res) => {
  try {
    const { serie, rut, desde, hasta, limit } = req.query;
    res.json(await db.getHistorial({ serie, rut, desde, hasta, limit: limit ? parseInt(limit) : 100 }));
  } catch {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// ── Import ────────────────────────────────────────────────────────────────────

router.post('/import/preview', authenticate, require('../middleware').requireAdmin, async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos para previsualizar' });
    }
    const { previewImportRows } = require('../importController');
    res.json(await previewImportRows(rows));
  } catch (error) {
    console.error('Error en preview:', error);
    res.status(500).json({ error: 'Error procesando la vista previa: ' + error.message });
  }
});

router.post('/import/commit', authenticate, require('../middleware').requireAdmin, async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos para importar' });
    }
    const { processImportRows } = require('../importController');
    const results = await processImportRows(rows, req.user.id);
    res.json({ message: 'Importación completada', ...results });
  } catch (error) {
    console.error('Error importando:', error);
    res.status(500).json({ error: 'Error importando datos: ' + error.message });
  }
});

// ── Agente IA ─────────────────────────────────────────────────────────────────

router.post('/chat', authenticate, agentLimiter, async (req, res) => {
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
    console.error('Error en agente:', err.message, err.status, err.error);
    const detail = err.status === 401 ? 'API key inválida o revocada.'
      : err.status === 429 ? 'Límite de la API de Anthropic alcanzado.'
      : err.message || 'Error interno.';
    res.status(500).json({ error: `Error en el agente: ${detail}` });
  }
});

// ── Export SQL (superadmin) ───────────────────────────────────────────────────

router.get('/export-sql', authenticate, requireSuperAdmin, async (req, res) => {
  const escape = (val) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'number') return val;
    if (val instanceof Date) return `'${val.toISOString()}'`;
    return `'${String(val).replace(/'/g, "''")}'`;
  };
  try {
    let sql = `-- BACKUP IT COMPASS ${new Date().toISOString()}\nSET session_replication_role = replica;\n\n`;
    for (const table of ['usuarios', 'colaboradores', 'activos', 'historial_activos']) {
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
  } catch {
    res.status(500).json({ error: 'Error exportando respaldo' });
  }
});

// ── Migración manual (superadmin) ─────────────────────────────────────────────

router.get('/migrate', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    await db.query(`
      ALTER TABLE activos      ADD COLUMN IF NOT EXISTS imsi            VARCHAR(20);
      ALTER TABLE activos      ADD COLUMN IF NOT EXISTS numero_telefono VARCHAR(20);
      ALTER TABLE activos      ADD COLUMN IF NOT EXISTS compania        VARCHAR(50);
      ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;
      ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS activo         BOOLEAN DEFAULT TRUE;
      CREATE TABLE IF NOT EXISTS areas (
        id     SERIAL PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL
      );
      CREATE TABLE IF NOT EXISTS asignaciones (
        id                 SERIAL PRIMARY KEY,
        serie_activo       VARCHAR(100) NOT NULL,
        rut_colaborador    VARCHAR(20)  NOT NULL,
        fecha_inicio       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        fecha_fin          TIMESTAMPTZ,
        estado             VARCHAR(20)  NOT NULL DEFAULT 'activa',
        motivo_devolucion  TEXT,
        notas              TEXT,
        usuario_id         INTEGER REFERENCES usuarios(id),
        token_confirmacion VARCHAR(100),
        created_at         TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    res.json({ message: 'Base de datos actualizada exitosamente.' });
  } catch (e) {
    console.error('Error en migración:', e);
    res.status(500).json({ error: 'Error al actualizar la base de datos: ' + e.message });
  }
});

module.exports = router;
