/**
 * lib/consistencia.js
 * Detección pura de inconsistencia estado/asignación de un Activo.
 *
 * Contrato (Property 33 — Req. 14.3):
 * - Un Activo es inconsistente SI Y SOLO SI su estado es `Asignado` y
 *   NO existe para él una Asignacion en estado `activa`.
 * - Función pura: sin efectos secundarios, sin acceso a BD.
 *
 * El estado `Asignado` es el único que exige una asignación activa; cualquier
 * otro estado (Disponible, Mantenimiento, Descartado) nunca es inconsistente
 * bajo esta regla.
 */

const ESTADO_ASIGNADO = 'Asignado';

/**
 * Determina si un Activo presenta inconsistencia estado/asignación.
 *
 * @param {object} params
 * @param {string} params.estado - Estado actual del Activo (ej. 'Asignado', 'Disponible').
 * @param {boolean} params.asignacionActiva - `true` si existe una Asignacion en estado `activa` para el Activo.
 * @returns {boolean} `true` si y solo si estado === 'Asignado' && !asignacionActiva.
 */
function esInconsistente({ estado, asignacionActiva } = {}) {
  return estado === ESTADO_ASIGNADO && !asignacionActiva;
}

module.exports = {
  esInconsistente,
  ESTADO_ASIGNADO,
};
