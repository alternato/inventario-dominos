const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'inventario_db',
  user: process.env.DB_USER || 'inventario_user',
  password: process.env.DB_PASSWORD || 'secreto_super_fuerte_prod_2026',
});

(async () => {
  try {
    const res = await pool.query(`
      UPDATE usuarios 
      SET nombre = 'SuperAdministrador' 
      WHERE email = 'admin@dominospizza.cl' OR pin = '012016'
      RETURNING *;
    `);
    
    if (res.rows.length > 0) {
      console.log('✅ Admin actualizado correctamente: ', res.rows[0].nombre);
    } else {
      console.log('❌ No se encontró el usuario admin@dominospizza.cl ni el PIN 012016');
    }
  } catch (err) {
    console.error('Error al actualizar:', err);
  } finally {
    pool.end();
  }
})();
