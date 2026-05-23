const router = require('express').Router();
const db = require('../db');
const { createUsuarioSchema, updateUsuarioSchema, validate } = require('../schemas');
const { authenticate, requireSuperAdmin } = require('../middleware');

router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await db.getUsuarios());
  } catch {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.post('/', authenticate, requireSuperAdmin, validate(createUsuarioSchema), async (req, res) => {
  try {
    const usuario = await db.createUsuario(req.body);
    res.status(201).json(usuario);
  } catch (error) {
    console.error('createUsuario:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.put('/:id', authenticate, requireSuperAdmin, validate(updateUsuarioSchema), async (req, res) => {
  try {
    const usuario = await db.updateUsuario(parseInt(req.params.id), req.body);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (error) {
    console.error('updateUsuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

module.exports = router;
