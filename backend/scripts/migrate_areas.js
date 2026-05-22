require('dotenv').config();
const { pool } = require('./db');

async function migrate() {
  try {
    console.log('--- Iniciando Migración de Áreas ---');
    
    // 1. Crear tabla areas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS areas (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabla areas creada.');

    // 2. Eliminar restricción antigua de colaboradores
    await pool.query(`
      ALTER TABLE colaboradores DROP CONSTRAINT IF EXISTS colaboradores_area_check;
    `);
    console.log('✅ Restricción CHECK eliminada de colaboradores.');

    // 3. Migrar datos existentes
    await pool.query(`
      INSERT INTO areas (nombre)
      SELECT DISTINCT area FROM colaboradores
      ON CONFLICT (nombre) DO NOTHING;
    `);
    console.log('✅ Áreas existentes migradas a la tabla maestra.');

    console.log('--- Migración completada con éxito ---');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en migración:', err);
    process.exit(1);
  }
}

migrate();
