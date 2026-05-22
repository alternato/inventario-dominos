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
    
    // Primero, eliminamos las vistas dinámicas temporalmente
    await pool.query(`
      DROP VIEW IF EXISTS v_colaboradores_resumen;
      DROP VIEW IF EXISTS v_activos;
    `);

    await pool.query(`
      ALTER TABLE activos 
      ADD COLUMN IF NOT EXISTS numero_telefono VARCHAR(50),
      ADD COLUMN IF NOT EXISTS compania VARCHAR(100);
    `);
    
    // Agrandamos límite de strings para soportar caracteres especiales
    await pool.query(`
      ALTER TABLE activos 
      ALTER COLUMN imei TYPE VARCHAR(50),
      ALTER COLUMN numero_sim TYPE VARCHAR(50),
      ALTER COLUMN imsi TYPE VARCHAR(50);
    `);

    // Volvemos a construir las vistas actualizadas
    await pool.query(`
      CREATE OR REPLACE VIEW v_activos AS
      SELECT
        a.*,
        c.nombre  AS colaborador_nombre,
        c.correo  AS colaborador_correo,
        c.area    AS colaborador_area,
        c.cargo   AS colaborador_cargo
      FROM activos a
      LEFT JOIN colaboradores c ON a.rut_responsable = c.rut;

      CREATE OR REPLACE VIEW v_colaboradores_resumen AS
      SELECT
        c.*,
        COUNT(a.serie) FILTER (WHERE a.estado = 'Asignado') AS total_activos_asignados
      FROM colaboradores c
      LEFT JOIN activos a ON a.rut_responsable = c.rut
      GROUP BY c.id;
    `);

    console.log('✅ Migración exitosa. Campos "numero_telefono" y "compania" agregados correctamente a la tabla "activos".');
  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
