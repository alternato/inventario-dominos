const router = require('express').Router();
const db = require('../db');
const { createActivoSchema, updateActivoSchema, validate } = require('../schemas');
const { authenticate, requireAdmin } = require('../middleware');

router.get('/', authenticate, async (req, res) => {
  try {
    res.json(await db.getActivos());
  } catch {
    res.status(500).json({ error: 'Error al obtener activos' });
  }
});

router.get('/:serie/historial', authenticate, async (req, res) => {
  try {
    res.json(await db.getHistorial({ serie: req.params.serie }));
  } catch {
    res.status(500).json({ error: 'Error al obtener historial del activo' });
  }
});

router.get('/:serie/asignaciones', authenticate, async (req, res) => {
  try {
    const { rows } = await db.pool.query(`
      SELECT a.*, c.nombre AS colaborador_nombre, c.correo AS colaborador_correo, c.area AS colaborador_area
      FROM asignaciones a
      JOIN colaboradores c ON a.rut_colaborador = c.rut
      WHERE a.serie_activo = $1
      ORDER BY a.created_at DESC
    `, [req.params.serie]);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener historial de asignaciones' });
  }
});

router.get('/:serie', authenticate, async (req, res) => {
  try {
    const activo = await db.getActivoBySerie(req.params.serie);
    if (!activo) return res.status(404).json({ error: 'Activo no encontrado' });
    res.json(activo);
  } catch {
    res.status(500).json({ error: 'Error al obtener activo' });
  }
});

router.post('/', authenticate, validate(createActivoSchema), async (req, res) => {
  try {
    const activo = await db.createActivo(req.body, req.user.id);
    res.status(201).json(activo);
  } catch (error) {
    console.error('createActivo:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un activo con esa serie' });
    res.status(500).json({ error: 'Error al crear activo' });
  }
});

router.put('/:serie', authenticate, validate(updateActivoSchema), async (req, res) => {
  try {
    res.json(await db.updateActivo(req.params.serie, req.body, req.user.id));
  } catch (error) {
    console.error('updateActivo:', error);
    res.status(500).json({ error: 'Error al actualizar activo' });
  }
});

router.delete('/:serie', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.deleteActivo(req.params.serie, req.user.id);
    res.json({ message: 'Activo eliminado' });
  } catch (error) {
    console.error('deleteActivo:', error);
    res.status(500).json({ error: 'Error al eliminar activo' });
  }
});

module.exports = router;
