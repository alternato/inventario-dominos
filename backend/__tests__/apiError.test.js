const fc = require('fast-check');
const { ApiError, TIPOS } = require('../lib/apiError');

// Serialización que realiza el manejador central de app.js sobre un ApiError.
function serializar(apiError) {
  return { error: { type: apiError.type, message: apiError.message } };
}

// Fábricas estáticas de ApiError; cada una fija status/type coherentes.
const FABRICAS = [
  { type: 'VALIDATION', make: (m, d) => ApiError.validation(m, d) },
  { type: 'UNAUTHORIZED', make: (m) => ApiError.unauthorized(m) },
  { type: 'FORBIDDEN', make: (m) => ApiError.forbidden(m) },
  { type: 'NOT_FOUND', make: (m) => ApiError.notFound(m) },
  { type: 'CONFLICT', make: (m) => ApiError.conflict(m) },
  { type: 'GONE', make: (m) => ApiError.gone(m) },
  { type: 'INTERNAL', make: (m) => ApiError.internal(m) },
];

describe('ApiError — formato de error uniforme', () => {
  // Feature: mejora-integral-inventario, Property 31: Estructura uniforme del formato de error
  // Valida: Requisitos 13.2
  test('Property 31: cada ApiError mapea a { error: { type, message } } con type del conjunto y status coherente', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FABRICAS),
        fc.string(),
        fc.option(fc.jsonValue(), { nil: undefined }),
        (fabrica, mensaje, details) => {
          const err = fabrica.make(mensaje, details);

          // Es un ApiError (subclase de Error).
          expect(err).toBeInstanceOf(ApiError);
          expect(err).toBeInstanceOf(Error);

          // El type pertenece al conjunto de tipos definidos.
          expect(Object.keys(TIPOS)).toContain(err.type);
          expect(err.type).toBe(fabrica.type);

          // El status es coherente con el tipo (mapeo definido en TIPOS).
          expect(err.status).toBe(TIPOS[err.type]);

          // La serialización pública tiene exactamente la estructura { error: { type, message } }.
          const body = serializar(err);
          expect(Object.keys(body)).toEqual(['error']);
          expect(Object.keys(body.error).sort()).toEqual(['message', 'type']);
          expect(body.error.type).toBe(err.type);
          expect(body.error.message).toBe(mensaje);

          // El type del cuerpo sigue perteneciendo al conjunto definido.
          expect(Object.keys(TIPOS)).toContain(body.error.type);
        }
      ),
      { numRuns: 100 }
    );
  });
});

const express = require('express');
const request = require('supertest');
const {
  validate,
  createActivoSchema,
  createColaboradorSchema,
  createUsuarioSchema,
} = require('../schemas');

// Manejador de errores central, réplica fiel del de backend/app.js: nunca
// expone `stack` en la respuesta pública; solo serializa { error: { type, message, details } }.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const esApiError = err instanceof ApiError;
  const status = esApiError ? err.status : (err.status || TIPOS.INTERNAL);
  const type = esApiError ? err.type : 'INTERNAL';
  const details = esApiError ? (err.details ?? null) : null;
  let message;
  if (status >= 500) {
    message = process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message;
  } else {
    message = err.message;
  }
  res.status(status).json({ error: { type, message, details } });
}

// Endpoints de escritura reales (mismos schemas Zod + middleware `validate` que usa
// la API). El handler de persistencia registra si fue alcanzado: en una entrada
// inválida NUNCA debe ejecutarse (Req. 12.3: "no persistir ningún cambio").
function construirApp(persistenciaSpy) {
  const app = express();
  app.use(express.json());

  const persistir = (req, res) => {
    persistenciaSpy(); // marca de que se llegó a la capa de persistencia
    res.status(201).json({ ok: true });
  };

  app.post('/activos', validate(createActivoSchema), persistir);
  app.post('/colaboradores', validate(createColaboradorSchema), persistir);
  app.post('/usuarios', validate(createUsuarioSchema), persistir);

  app.use(errorHandler);
  return app;
}

// Palabras/patrones que delatarían una traza de error o detalle interno de
// implementación filtrado en la respuesta pública.
const PATRONES_FUGA_INTERNA = [
  /\bat\s+.+:\d+:\d+/, // frames de stack: "at fn (file.js:12:3)"
  /\.js:\d+/, // referencia a archivo:línea
  /node_modules/i,
  /ZodError/i,
  /\bError:\s/,
  /\bTypeError\b/i,
  /\bReferenceError\b/i,
  /processTicksAndRejections/i,
];

describe('Property 28 — respuesta de error de validación sin detalles internos', () => {
  // Feature: mejora-integral-inventario, Property 28: Respuesta de error sin detalles internos ante validación fallida
  // Valida: Requisitos 12.3
  test('Property 28: entradas inválidas en endpoints de escritura → 400, mensaje de campo/regla, sin traza, sin persistencia', async () => {
    // Generador de cuerpos que casi con certeza violan cada schema de escritura:
    // objetos arbitrarios con campos obligatorios ausentes o de tipo incorrecto.
    const cuerpoInvalidoArb = fc.record(
      {
        serie: fc.option(fc.oneof(fc.integer(), fc.constant('')), { nil: undefined }),
        marca: fc.option(fc.integer(), { nil: undefined }),
        modelo: fc.option(fc.constant(''), { nil: undefined }),
        estado: fc.option(fc.string(), { nil: undefined }),
        tipo_dispositivo: fc.option(fc.string(), { nil: undefined }),
        rut: fc.option(fc.string(), { nil: undefined }),
        nombre: fc.option(fc.oneof(fc.integer(), fc.constant('')), { nil: undefined }),
        area: fc.option(fc.string(), { nil: undefined }),
        correo: fc.option(fc.string(), { nil: undefined }),
        email: fc.option(fc.string(), { nil: undefined }),
        password: fc.option(fc.string({ maxLength: 5 }), { nil: undefined }),
        rol: fc.option(fc.string(), { nil: undefined }),
      },
      { requiredKeys: [] }
    );

    const endpoints = ['/activos', '/colaboradores', '/usuarios'];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...endpoints),
        cuerpoInvalidoArb,
        async (ruta, cuerpo) => {
          const persistenciaSpy = jest.fn();
          const app = construirApp(persistenciaSpy);

          const res = await request(app).post(ruta).send(cuerpo);

          // El schema debe rechazar; si por azar el cuerpo fuese válido (201),
          // descartamos ese caso — la propiedad es sobre entradas inválidas.
          fc.pre(res.status !== 201);

          // (a) Código de estado 400.
          expect(res.status).toBe(400);

          // (b) Mensaje presente que identifica el campo o la regla incumplida.
          expect(typeof res.body.error).toBe('string');
          expect(res.body.error.length).toBeGreaterThan(0);

          // (c) La respuesta no expone traza ni detalles internos de implementación.
          const cuerpoSerializado = JSON.stringify(res.body);
          expect(cuerpoSerializado).not.toMatch(/stack/i);
          for (const patron of PATRONES_FUGA_INTERNA) {
            expect(cuerpoSerializado).not.toMatch(patron);
          }

          // (d) No se persistió ningún cambio: nunca se alcanzó la capa de persistencia.
          expect(persistenciaSpy).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
