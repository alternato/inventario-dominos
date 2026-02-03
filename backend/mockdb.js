// Base de datos en memoria para testing (sin Supabase)
const bcrypt = require('bcryptjs');

// Crear usuario admin de prueba
const adminPassword = bcrypt.hashSync('AdminDominos2026', 10);

const mockDatabase = {
  usuarios: [
    {
      id: 1,
      email: 'admin@dominospizza.cl',
      nombre: 'Administrador TI',
      password: adminPassword,
      rol: 'admin',
      activo: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  colaboradores: [],
  activos: []
};

module.exports = mockDatabase;
