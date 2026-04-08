// Script para asignar un PIN de prueba al usuario admin
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'inventario_db',
  user:     process.env.DB_USER     || 'inventario_user',
  password: process.env.DB_PASSWORD || 'inventario_secret_2024',
  ssl: false,
});

async function seedPin() {
  const client = await pool.connect();
  const PIN = '123456'; // PIN de prueba
  try {
    const hashedPin = await bcrypt.hash(PIN, 10);
    const result = await client.query(
      `UPDATE usuarios SET pin = $1, updated_at = NOW()
       WHERE email = 'admin@dominospizza.cl'
       RETURNING id, email, nombre, rol`,
      [hashedPin]
    );
    if (result.rows.length === 0) {
      console.log('❌ No se encontró el usuario admin@dominospizza.cl');
    } else {
      console.log(`✅ PIN asignado correctamente a: ${result.rows[0].nombre} (${result.rows[0].email})`);
      console.log(`🔢 Tu PIN de prueba es: ${PIN}`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seedPin();
