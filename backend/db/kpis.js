const { query } = require('./pool');

const getKPIs = async () => {
  const [totales, porTipo, porEstado, topColaboradores, actividadMensual, duplicadosImeis, duplicadosSims] = await Promise.all([
    query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estado = 'Asignado') AS asignados,
        COUNT(*) FILTER (WHERE estado = 'Disponible') AS disponibles,
        COUNT(*) FILTER (WHERE estado = 'Mantenimiento') AS mantenimiento,
        COUNT(*) FILTER (WHERE estado = 'Descartado') AS descartados
      FROM activos
      WHERE deleted_at IS NULL
    `),
    query(`
      SELECT tipo_dispositivo, COUNT(*) AS cantidad
      FROM activos
      WHERE deleted_at IS NULL
      GROUP BY tipo_dispositivo
      ORDER BY cantidad DESC
    `),
    query(`
      SELECT estado, COUNT(*) AS cantidad
      FROM activos
      WHERE deleted_at IS NULL
      GROUP BY estado
    `),
    query(`
      SELECT
        c.nombre AS colaborador,
        c.area,
        COUNT(a.serie) AS total_equipos
      FROM colaboradores c
      INNER JOIN activos a ON a.rut_responsable = c.rut
      WHERE a.estado = 'Asignado'
        AND a.deleted_at IS NULL
        AND c.deleted_at IS NULL
      GROUP BY c.rut, c.nombre, c.area
      ORDER BY total_equipos DESC
      LIMIT 5
    `),
    query(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS mes,
        COUNT(*) AS total
      FROM historial_activos
      WHERE tipo_movimiento = 'asignacion'
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY mes
      ORDER BY mes ASC
    `),
    query(`
      SELECT imei, COUNT(*) AS cantidad, array_agg(serie) AS series
      FROM activos
      WHERE imei IS NOT NULL AND TRIM(imei) != ''
        AND deleted_at IS NULL
        AND estado != 'Descartado'
      GROUP BY imei
      HAVING COUNT(*) > 1
    `),
    query(`
      SELECT numero_sim, COUNT(*) AS cantidad, array_agg(serie) AS series
      FROM activos
      WHERE numero_sim IS NOT NULL AND TRIM(numero_sim) != ''
        AND deleted_at IS NULL
        AND estado != 'Descartado'
      GROUP BY numero_sim
      HAVING COUNT(*) > 1
    `),
  ]);

  return {
    totales: totales.rows[0],
    porTipo: porTipo.rows,
    porEstado: porEstado.rows,
    topColaboradores: topColaboradores.rows,
    actividadMensual: actividadMensual.rows,
    duplicados: {
      imeis: duplicadosImeis.rows,
      sims: duplicadosSims.rows,
    },
  };
};

module.exports = { getKPIs };
