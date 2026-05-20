// ============================================================
// run-migration.js
// Ejecuta el archivo SQL de migración 004_asignaciones.sql
// en la base de datos PostgreSQL local.
//
// USO: cd backend && node run-migration.js
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'inventario_db',
  user:     process.env.DB_USER     || 'inventario_user',
  password: process.env.DB_PASSWORD || 'inventario_secret_2024',
  ssl: false,
});

async function ejecutarMigracion() {
  const archivo = process.argv[2] || '004_asignaciones.sql';
  console.log(`🔄 Ejecutando migración SQL: ${archivo}...`);
  const migrationPath = path.join(__dirname, 'migrations', archivo);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ No se encontró el archivo de migración en: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    // Ejecutar el script SQL
    await pool.query(sql);
    console.log('✅ Migración ejecutada con éxito en la base de datos.');
  } catch (error) {
    console.error('❌ Error al ejecutar la migración SQL:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

ejecutarMigracion();
