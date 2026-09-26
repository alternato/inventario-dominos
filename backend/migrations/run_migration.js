// ============================================================
// run_migration.js — Runner de migraciones SQL correlativas
// Domino's Pizza Chile - Inventario TI
//
// Ejecuta las migraciones registradas en REGISTRO, en orden, contra la
// base PostgreSQL configurada por variables de entorno. Cada archivo es
// idempotente (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), por lo que el
// runner puede re-ejecutarse sin efectos secundarios y sin romper
// migraciones previas.
//
// USO:
//   cd backend
//   node migrations/run_migration.js                 -> ejecuta TODO el registro en orden
//   node migrations/run_migration.js 006_mejoras_integrales.sql
//                                                     -> ejecuta sólo ese archivo
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------
// Registro ordenado de migraciones. Añadir nuevas al final.
// Todas viven en este mismo directorio (backend/migrations).
// ------------------------------------------------------------
const REGISTRO = [
  'add_pin_to_usuarios.sql',
  '004_asignaciones.sql',
  '005_crear_tabla_areas.sql',
  '006_mejoras_integrales.sql',
];

const MIGRATIONS_DIR = __dirname;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'inventario_db',
  user: process.env.DB_USER || 'inventario_user',
  password: process.env.DB_PASSWORD || 'inventario_secret_2024',
  ssl: false,
});

async function ejecutarArchivo(client, archivo) {
  const migrationPath = path.join(MIGRATIONS_DIR, archivo);
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`No se encontró el archivo de migración: ${migrationPath}`);
  }
  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`🔄 Aplicando ${archivo}...`);
  // Cada archivo se envuelve en su propia transacción: si falla, se revierte
  // por completo y no deja el esquema a medias.
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`✅ ${archivo} aplicada.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function migrate() {
  // Argumento opcional: nombre de un único archivo a ejecutar.
  const soloArchivo = process.argv[2];
  const lista = soloArchivo ? [soloArchivo] : REGISTRO;

  const client = await pool.connect();
  try {
    console.log('🔄 Ejecutando migraciones...');
    for (const archivo of lista) {
      await ejecutarArchivo(client, archivo);
    }
    console.log('✅ Todas las migraciones se aplicaron correctamente.');
    console.log('ℹ️  (Idempotentes: lo ya existente se omite — todo OK)');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
