const { pool } = require('./db');

async function migrateSoftDeletes() {
  const client = await pool.connect();

  try {
    console.log('Iniciando migración de eliminación suave (Soft Deletes)...');
    await client.query('BEGIN');

    // 1. Eliminar temporalmente las vistas que dependen de estas tablas
    console.log('1. Eliminando vistas dependientes temporalmente...');
    await client.query('DROP VIEW IF EXISTS v_activos CASCADE;');
    await client.query('DROP VIEW IF EXISTS v_colaboradores_resumen CASCADE;');

    // 2. Agregar la columna deleted_at a las tablas principales
    console.log('2. Agregando columnas deleted_at a usuarios, colaboradores y activos...');
    
    // Usuarios
    await client.query(`
      ALTER TABLE usuarios 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
    `);

    // Colaboradores
    await client.query(`
      ALTER TABLE colaboradores 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
    `);

    // Activos
    await client.query(`
      ALTER TABLE activos 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
    `);

    // 3. Recrear las vistas filtrando los elementos eliminados
    console.log('3. Recreando vistas con filtro de eliminados...');
    
    // Vista: v_activos (ignora activos eliminados)
    await client.query(`
      CREATE OR REPLACE VIEW v_activos AS
      SELECT
        a.*,
        c.nombre  AS colaborador_nombre,
        c.correo  AS colaborador_correo,
        c.area    AS colaborador_area,
        c.cargo   AS colaborador_cargo
      FROM activos a
      LEFT JOIN colaboradores c ON a.rut_responsable = c.rut AND c.deleted_at IS NULL
      WHERE a.deleted_at IS NULL;
    `);

    // Vista: v_colaboradores_resumen (ignora colaboradores eliminados y no cuenta activos eliminados)
    await client.query(`
      CREATE OR REPLACE VIEW v_colaboradores_resumen AS
      SELECT
        c.*,
        COUNT(a.serie) FILTER (WHERE a.estado = 'Asignado' AND a.deleted_at IS NULL) AS total_activos_asignados
      FROM colaboradores c
      LEFT JOIN activos a ON a.rut_responsable = c.rut
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, c.rut;
    `);

    await client.query('COMMIT');
    console.log('✅ Migración de Soft Deletes completada exitosamente.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la migración de Soft Deletes:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0); // Forzar cierre porque el db pool de lo contrario se queda abierto
  }
}

migrateSoftDeletes();
