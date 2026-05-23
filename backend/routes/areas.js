const router = require('express').Router();
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware');

router.get('/', authenticate, async (req, res) => {
  try {
    res.json(await db.getAreas());
  } catch {
    res.status(500).json({ error: 'Error al obtener áreas' });
  }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
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

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    res.json(await db.updateArea(parseInt(req.params.id), req.body.nombre));
  } catch {
    res.status(500).json({ error: 'Error al actualizar área' });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.deleteArea(parseInt(req.params.id));
    res.json({ message: 'Área eliminada' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar área' });
  }
});

module.exports = router;
