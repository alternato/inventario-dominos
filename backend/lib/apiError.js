/**
 * ApiError — error de aplicación con formato uniforme (Req. 13.2, 12.3).
 *
 * Cada error de negocio se representa como un ApiError con:
 *  - status:  código HTTP (400, 401, 403, 404, 409, 410, 500)
 *  - type:    tipo semántico del conjunto TIPOS
 *  - message: mensaje legible para el consumidor
 *  - details: información adicional opcional (p.ej. campos faltantes)
 *
 * El manejador central de errores de `app.js` serializa cualquier ApiError a:
 *   { error: { type, message, details } }
 */

// Tipos permitidos y su código HTTP asociado.
const TIPOS = Object.freeze({
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  INTERNAL: 500,
});

class ApiError extends Error {
  constructor(status, type, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 400, 401, 403, 404, 409, 410, 500
    this.type = type; // 'VALIDATION' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'GONE' | 'INTERNAL'
    this.details = details; // p.ej. lista de campos faltantes
    // Mantener un stack trace limpio apuntando al origen de la llamada.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  // Helpers estáticos: cada uno fija el status/type coherente del conjunto TIPOS.
  static validation(message = 'Datos inválidos', details = null) {
    return new ApiError(TIPOS.VALIDATION, 'VALIDATION', message, details);
  }

  static unauthorized(message = 'No autorizado', details = null) {
    return new ApiError(TIPOS.UNAUTHORIZED, 'UNAUTHORIZED', message, details);
  }

  static forbidden(message = 'Permisos insuficientes', details = null) {
    return new ApiError(TIPOS.FORBIDDEN, 'FORBIDDEN', message, details);
  }

  static notFound(message = 'Recurso no encontrado', details = null) {
    return new ApiError(TIPOS.NOT_FOUND, 'NOT_FOUND', message, details);
  }

  static conflict(message = 'Conflicto con el estado actual', details = null) {
    return new ApiError(TIPOS.CONFLICT, 'CONFLICT', message, details);
  }

  static gone(message = 'El recurso ya no está disponible', details = null) {
    return new ApiError(TIPOS.GONE, 'GONE', message, details);
  }

  static internal(message = 'Error interno del servidor', details = null) {
    return new ApiError(TIPOS.INTERNAL, 'INTERNAL', message, details);
  }
}

module.exports = { ApiError, TIPOS };
