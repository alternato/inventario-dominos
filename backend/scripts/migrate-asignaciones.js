// ============================================================
// migrate-asignaciones.js
// Migra las asignaciones actuales (basadas en rut_responsable)
// a la nueva tabla asignaciones.
//
// USO: cd backend && node migrate-asignaciones.js
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'inventario_db',
  user:     process.env.DB_USER     || 'inventario_user',
  password: process.env.DB_PASSWORD || '',
  ssl: false,
});

const ok  = (msg) => console.log(`  ✅ ${msg}`);
const log = (msg) => console.log(`  → ${msg}`);
const err = (msg) => console.error(`  ❌ ${msg}`);

async function migrar() {
  console.log('');
  console.log('🔄 Migrando asignaciones existentes...');
  console.log('='.repeat(50));

  // 1. Verificar que la tabla asignaciones existe
  const { rows: tablas } = await pool.query(
    `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'asignaciones') AS existe`
  );
  if (!tablas[0].existe) {
    err('La tabla asignaciones no existe. Ejecuta primero: migrations/004_asignaciones.sql');
    process.exit(1);
  }
  ok('Tabla asignaciones encontrada');

  // 2. Activos con rut_responsable != null que NO tienen asignación activa
  const { rows: activosAsignados } = await pool.query(`
    SELECT a.serie, a.rut_responsable, a.estado, a.created_at
    FROM activos a
    WHERE a.rut_responsable IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM asignaciones asig
        WHERE asig.serie_activo = a.serie AND asig.estado = 'activa'
      )
  `);

  log(`Activos con responsable sin asignación registrada: ${activosAsignados.length}`);

  let creadas = 0;
  for (const activo of activosAsignados) {
    try {
      // Verificar que el colaborador existe
      const { rows: [colab] } = await pool.query(
        'SELECT rut FROM colaboradores WHERE rut = $1', [activo.rut_responsable]
      );
      if (!colab) {
        log(`⚠️  Colaborador ${activo.rut_responsable} no encontrado para activo ${activo.serie} — omitido`);
        continue;
      }

      await pool.query(`
        INSERT INTO asignaciones (serie_activo, rut_colaborador, fecha_inicio, estado, notas)
        VALUES ($1, $2, $3, 'activa', 'Migrado automáticamente desde datos anteriores')
        ON CONFLICT DO NOTHING
      `, [activo.serie, activo.rut_responsable, activo.created_at || new Date()]);
      creadas++;
    } catch (e) {
      log(`⚠️  ${activo.serie}: ${e.message.split('\n')[0]}`);
    }
  }
  ok(`Asignaciones activas creadas: ${creadas}`);

  // 3. Crear asignaciones cerradas desde historial (tipo 'asignacion'/'devolucion')
  const { rows: historialPairs } = await pool.query(`
    SELECT DISTINCT ON (h_asig.serie, h_asig.rut_nuevo)
      h_asig.serie,
      h_asig.rut_nuevo       AS rut_colaborador,
      h_asig.created_at      AS fecha_inicio,
      h_dev.created_at       AS fecha_fin,
      h_dev.notas            AS motivo
    FROM historial_activos h_asig
    LEFT JOIN historial_activos h_dev
      ON h_dev.serie = h_asig.serie
      AND h_dev.tipo_movimiento = 'devolucion'
      AND h_dev.created_at > h_asig.created_at
    WHERE h_asig.tipo_movimiento = 'asignacion'
      AND h_asig.rut_nuevo IS NOT NULL
      AND h_dev.id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM asignaciones asig
        WHERE asig.serie_activo = h_asig.serie
          AND asig.rut_colaborador = h_asig.rut_nuevo
          AND asig.estado = 'cerrada'
          AND DATE(asig.fecha_inicio) = DATE(h_asig.created_at)
      )
    ORDER BY h_asig.serie, h_asig.rut_nuevo, h_asig.created_at
  `);

  log(`Asignaciones históricas (cerradas) a migrar: ${historialPairs.length}`);

  let historicas = 0;
  for (const h of historialPairs) {
    try {
      const { rows: [colab] } = await pool.query(
        'SELECT rut FROM colaboradores WHERE rut = $1', [h.rut_colaborador]
      );
      if (!colab) continue;

      await pool.query(`
        INSERT INTO asignaciones
          (serie_activo, rut_colaborador, fecha_inicio, fecha_fin, estado, motivo_devolucion, notas)
        VALUES ($1, $2, $3, $4, 'cerrada', $5, 'Migrado desde historial')
        ON CONFLICT DO NOTHING
      `, [h.serie, h.rut_colaborador, h.fecha_inicio, h.fecha_fin, h.motivo || null]);
      historicas++;
    } catch (e) {
      // Ignorar conflictos silenciosamente
    }
  }
  ok(`Asignaciones históricas cerradas creadas: ${historicas}`);

  // 4. Resumen
  const { rows: [total] } = await pool.query('SELECT COUNT(*) FROM asignaciones');
  console.log('');
  console.log('='.repeat(50));
  console.log(`🎉 Migración completada!`);
  console.log(`   Total de asignaciones en tabla: ${total.count}`);
  console.log('');

  await pool.end();
}

migrar().catch(e => {
  console.error('\n💥 Error:', e.message);
  process.exit(1);
});
