// ============================================================
// fix-inconsistencias.js
// Detecta activos asignados directamente en la tabla 'activos'
// que no tienen una asignación activa correspondiente en la tabla 'asignaciones',
// y las crea para mantener la consistencia del Tercer Eje.
//
// USO: docker exec -it inventario_backend_prod node fix-inconsistencias.js
// ============================================================
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

async function conciliarAsignaciones() {
  console.log('🔄 Iniciando conciliación de consistencia de asignaciones...');
  try {
    // 1. Obtener activos asignados
    const { rows: activos } = await pool.query(
      `SELECT serie, marca, modelo, rut_responsable, updated_at 
       FROM activos 
       WHERE estado = 'Asignado' AND rut_responsable IS NOT NULL`
    );

    console.log(`🔎 Se encontraron ${activos.length} activos con responsable asignado en la tabla 'activos'.`);

    let creadas = 0;

    for (const activo of activos) {
      // 2. Verificar si existe una asignación activa en la tabla 'asignaciones'
      const { rows: asignaciones } = await pool.query(
        `SELECT id FROM asignaciones 
         WHERE serie_activo = $1 AND estado = 'activa'`,
        [activo.serie]
      );

      if (asignaciones.length === 0) {
        console.log(`⚠️ Activo ${activo.marca} ${activo.modelo} (${activo.serie}) está asignado a ${activo.rut_responsable} pero no tiene asignación activa.`);
        
        // 3. Crear asignación activa faltante
        // Usamos la fecha de última actualización del activo como fecha de inicio
        const fechaInicio = activo.updated_at || new Date();
        
        await pool.query(
          `INSERT INTO asignaciones (serie_activo, rut_colaborador, fecha_inicio, estado, notas)
           VALUES ($1, $2, $3, 'activa', 'Conciliación: Creado automáticamente para restaurar consistencia de datos')`,
          [activo.serie, activo.rut_responsable, fechaInicio]
        );
        
        console.log(`✅ Asignación activa creada para la serie ${activo.serie} a colaborador ${activo.rut_responsable}.`);
        creadas++;
      }
    }

    console.log(`\n🎉 Conciliación finalizada. Se crearon ${creadas} asignaciones activas faltantes.`);

  } catch (error) {
    console.error('❌ Error durante la conciliación:', error.message);
  } finally {
    await pool.end();
  }
}

conciliarAsignaciones();
