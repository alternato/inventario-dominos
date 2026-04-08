// Script de migración: agregar columna PIN a usuarios
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'inventario_db',
  user:     process.env.DB_USER     || 'inventario_user',
  password: process.env.DB_PASSWORD || 'inventario_secret_2024',
  ssl: false,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Ejecutando migración...');
    await client.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pin VARCHAR(255) DEFAULT NULL;
    `);
    console.log('✅ Columna "pin" agregada exitosamente a la tabla usuarios.');
    console.log('ℹ️  (Si ya existía, no se modificó nada — todo OK)');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
