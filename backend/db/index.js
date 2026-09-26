const { pool, query } = require('./pool');
const { registrarHistorial, getHistorial } = require('./historial');
const { getUsuarioByEmail, getUsuarios, createUsuario, updateUsuario, updatePasswordReset, resetPassword, revocarSesion, sesionRevocada, limpiarSesionesRevocadas } = require('./usuarios');
const { getColaboradores, getColaboradorByRut, getActivosByColaborador, createColaborador, updateColaborador, desactivarColaborador, deleteColaborador } = require('./colaboradores');
const { getActivos, getActivoBySerie, createActivo, updateActivo, deleteActivo } = require('./activos');
const { getKPIs } = require('./kpis');
const { buscarGlobal } = require('./busqueda');
const { getAreas, createArea, updateArea, deleteArea } = require('./areas');
const { crearAsignacion, cerrarAsignacion, confirmarFirma, getAsignaciones } = require('./asignaciones');

module.exports = {
  pool,
  query,
  // Usuarios
  getUsuarioByEmail,
  getUsuarios,
  createUsuario,
  updateUsuario,
  updatePasswordReset,
  resetPassword,
  revocarSesion,
  sesionRevocada,
  limpiarSesionesRevocadas,
  // Activos
  getActivos,
  getActivoBySerie,
  createActivo,
  updateActivo,
  deleteActivo,
  // Colaboradores
  getColaboradores,
  getColaboradorByRut,
  getActivosByColaborador,
  createColaborador,
  updateColaborador,
  desactivarColaborador,
  deleteColaborador,
  // Historial
  registrarHistorial,
  getHistorial,
  // Búsqueda
  buscarGlobal,
  // KPIs
  getKPIs,
  // Áreas
  getAreas,
  createArea,
  updateArea,
  deleteArea,
  // Asignaciones
  crearAsignacion,
  cerrarAsignacion,
  confirmarFirma,
  getAsignaciones,
};
