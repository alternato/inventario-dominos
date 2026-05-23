const router = require('express').Router();
const db = require('../db');
const { createColaboradorSchema, updateColaboradorSchema, validate } = require('../schemas');
const { authenticate, requireAdmin } = require('../middleware');

router.get('/', authenticate, async (req, res) => {
  try {
    res.json(await db.getColaboradores());
  } catch {
    res.status(500).json({ error: 'Error al obtener colaboradores' });
  }
});

router.get('/:rut/activos', authenticate, async (req, res) => {
  try {
    res.json(await db.getActivosByColaborador(req.params.rut));
  } catch {
    res.status(500).json({ error: 'Error al obtener activos del colaborador' });
  }
});

router.get('/:rut/asignaciones', authenticate, async (req, res) => {
  try {
    const { rows } = await db.pool.query(`
      SELECT a.*, act.marca, act.modelo, act.tipo_dispositivo, act.serie, act.imei
      FROM asignaciones a
      JOIN activos act ON a.serie_activo = act.serie
      WHERE a.rut_colaborador = $1
      ORDER BY a.created_at DESC
    `, [req.params.rut]);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener historial del colaborador' });
  }
});

router.get('/:rut', authenticate, async (req, res) => {
  try {
    const colaborador = await db.getColaboradorByRut(req.params.rut);
    if (!colaborador) return res.status(404).json({ error: 'Colaborador no encontrado' });
    res.json(colaborador);
  } catch {
    res.status(500).json({ error: 'Error al obtener colaborador' });
  }
});

router.post('/', authenticate, validate(createColaboradorSchema), async (req, res) => {
  try {
    const colaborador = await db.createColaborador(req.body);
    res.status(201).json(colaborador);
  } catch (error) {
    console.error('createColaborador:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un colaborador con ese RUT' });
    res.status(500).json({ error: 'Error al crear colaborador' });
  }
});

router.put('/:rut', authenticate, validate(updateColaboradorSchema), async (req, res) => {
  try {
    res.json(await db.updateColaborador(req.params.rut, req.body));
  } catch (error) {
    console.error('updateColaborador:', error);
    res.status(500).json({ error: 'Error al actualizar colaborador' });
  }
});

router.delete('/:rut', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.deleteColaborador(req.params.rut);
    res.json({ message: 'Colaborador eliminado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar colaborador' });
  }
});

module.exports = router;
