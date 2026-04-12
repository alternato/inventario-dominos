const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'inventario_db',
  user:     process.env.DB_USER     || 'inventario_user',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  try {
    console.log('Conectando a la base de datos para añadir nuevos campos de telefonía...');
    
    await pool.query(`
      ALTER TABLE activos 
      ADD COLUMN IF NOT EXISTS numero_telefono VARCHAR(50),
      ADD COLUMN IF NOT EXISTS compania VARCHAR(100);
    `);
    
    // Además por si acaso agrandamos imei, imsi y numero_sim a VARCHAR(50) 
    // en lugar de 20 por si hay datos más grandes.
    await pool.query(`
      ALTER TABLE activos 
      ALTER COLUMN imei TYPE VARCHAR(50),
      ALTER COLUMN numero_sim TYPE VARCHAR(50),
      ALTER COLUMN imsi TYPE VARCHAR(50);
    `);

    console.log('✅ Migración exitosa. Campos "numero_telefono" y "compania" agregados correctamente a la tabla "activos".');
  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
