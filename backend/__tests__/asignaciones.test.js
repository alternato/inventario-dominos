/**
 * __tests__/asignaciones.test.js
 *
 * Pruebas basadas en propiedades (PBT) para el módulo transaccional
 * `db/asignaciones.js` (Feature: mejora-integral-inventario).
 *
 * Estrategia (ver design.md → Testing Strategy):
 *  - Se mockea el pool de `pg` (`db/pool.js`) para ejecutar sin base de datos
 *    real. `pool.connect()` devuelve un cliente falso que interpreta el texto
 *    SQL de cada consulta y responde contra un estado en memoria configurable.
 *  - El cliente registra la secuencia de `query()` para poder afirmar sobre el
 *    orden de BEGIN/COMMIT/ROLLBACK, INSERT de historial, etc.
 *  - Se reutiliza `ApiError` de `lib/apiError.js` para verificar los códigos
 *    de estado (409/404/410) de los errores de negocio.
 *  - Cada propiedad ejecuta un mínimo de 100 iteraciones (`numRuns: 100`).
 */

const fc = require('fast-check');

// --- Mock del pool de pg (sin base de datos real) --------------------------
jest.mock('../db/pool', () => {
  const pool = {
    connect: jest.fn(),
    query: jest.fn(),
  };
  return { pool, query: (text, params) => pool.query(text, params) };
});

const { pool } = require('../db/pool');
const { ApiError } = require('../lib/apiError');
const {
  crearAsignacion,
  cerrarAsignacion,
  confirmarFirma,
  getAsignaciones,
} = require('../db/asignaciones');

// --- Helpers de mock --------------------------------------------------------

/**
 * Construye un cliente pg falso que:
 *  - registra cada `query` en `calls` (para afirmar orden/tipo),
 *  - delega en `handler(text, params, state)` para producir `{ rows }`,
 *  - respeta un `failAt` opcional para inyectar fallos en un paso arbitrario.
 *
 * @param {(text:string, params:any[]) => {rows:any[]}} handler
 * @param {{ failAtIndex?: number, failError?: Error }} [opts]
 */
function makeClient(handler, opts = {}) {
  const calls = [];
  let realQueryIndex = 0; // cuenta de consultas "de negocio" (no BEGIN/COMMIT/ROLLBACK)
  const client = {
    calls,
    released: false,
    query: jest.fn(async (text, params) => {
      const trimmed = String(text).trim();
      calls.push({ text: trimmed, params });

      const isTx = /^(BEGIN|COMMIT|ROLLBACK)/i.test(trimmed);

      // Inyección de fallo en un paso de negocio arbitrario.
      if (!isTx && opts.failAtIndex != null) {
        if (realQueryIndex === opts.failAtIndex) {
          realQueryIndex += 1;
          throw opts.failError || new Error('fallo inyectado');
        }
        realQueryIndex += 1;
      }

      if (isTx) return { rows: [] };
      return handler(trimmed, params) || { rows: [] };
    }),
    release: jest.fn(function () {
      client.released = true;
    }),
  };
  return client;
}

/** Cuenta cuántas veces se ejecutó una sentencia que matchea el patrón. */
function countCalls(client, regex) {
  return client.calls.filter((c) => regex.test(c.text)).length;
}

/** Encuentra la primera llamada cuyo texto matchea el patrón. */
function findCall(client, regex) {
  return client.calls.find((c) => regex.test(c.text));
}

// Generadores comunes.
const genSerie = fc.string({ minLength: 1, maxLength: 12 }).map((s) => 'SN' + s.replace(/\s/g, ''));
const genRut = fc
  .tuple(fc.integer({ min: 1000000, max: 25000000 }), fc.integer({ min: 0, max: 9 }))
  .map(([n, d]) => `${n}-${d}`);
const genEstadoFisico = fc.constantFrom('Disponible', 'En reparacion', 'De baja', 'Bodega');

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// 4.2 → Property 13
// ===========================================================================
describe('Property 13: Rechazo de doble asignación activa (Req 7.1)', () => {
  // Feature: mejora-integral-inventario, Property 13: Para todo Activo que ya tiene una Asignacion en estado `activa`, todo intento de crear una nueva Asignacion SHALL ser rechazado con código 409, no SHALL crear la Asignacion y el número de Asignaciones activas para ese Activo SHALL permanecer en uno.
  it('rechaza con 409, no inserta y mantiene el conteo de activas en 1', async () => {
    await fc.assert(
      fc.asyncProperty(genSerie, genRut, async (serie, rut) => {
        const client = makeClient((text) => {
          if (/FROM activos WHERE serie/i.test(text)) return { rows: [{ serie, estado: 'Disponible' }] };
          if (/FROM colaboradores WHERE rut/i.test(text)) return { rows: [{ rut }] };
          // Ya existe una asignación activa para el activo.
          if (/FROM asignaciones WHERE serie_activo .* estado = 'activa'/is.test(text)) {
            return { rows: [{ id: 1 }] };
          }
          return { rows: [] };
        });
        pool.connect.mockResolvedValue(client);

        let error;
        try {
          await crearAsignacion({ serie_activo: serie, rut_colaborador: rut });
        } catch (e) {
          error = e;
        }

        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(409);
        // No se ejecutó ningún INSERT en asignaciones.
        expect(countCalls(client, /INSERT INTO asignaciones/i)).toBe(0);
        // El conteo de activas observado sigue siendo 1 (la existente).
        // Debe hacerse ROLLBACK y no COMMIT.
        expect(countCalls(client, /^ROLLBACK/i)).toBe(1);
        expect(countCalls(client, /^COMMIT/i)).toBe(0);
        expect(client.released).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// 4.3 → Property 14
// ===========================================================================
describe('Property 14: Rechazo de referencias inexistentes en Asignacion (Req 7.2)', () => {
  // Feature: mejora-integral-inventario, Property 14: Para todo par (serie de Activo, RUT de Colaborador) en el que al menos una entidad no exista, la creación de la Asignacion SHALL ser rechazada con código 404 y no SHALL crearse ninguna Asignacion.
  it('rechaza con 404 y no inserta cuando falta el activo, el colaborador o ambos', async () => {
    await fc.assert(
      fc.asyncProperty(
        genSerie,
        genRut,
        // (activoExiste, colaboradorExiste) con al menos uno faltante.
        fc.constantFrom([true, false], [false, true], [false, false]),
        async (serie, rut, [activoExiste, colaboradorExiste]) => {
          const client = makeClient((text) => {
            if (/FROM activos WHERE serie/i.test(text)) return { rows: activoExiste ? [{ serie, estado: 'Disponible' }] : [] };
            if (/FROM colaboradores WHERE rut/i.test(text)) return { rows: colaboradorExiste ? [{ rut }] : [] };
            return { rows: [] };
          });
          pool.connect.mockResolvedValue(client);

          let error;
          try {
            await crearAsignacion({ serie_activo: serie, rut_colaborador: rut });
          } catch (e) {
            error = e;
          }

          expect(error).toBeInstanceOf(ApiError);
          expect(error.status).toBe(404);
          expect(countCalls(client, /INSERT INTO asignaciones/i)).toBe(0);
          expect(countCalls(client, /^ROLLBACK/i)).toBe(1);
          expect(countCalls(client, /^COMMIT/i)).toBe(0);
          expect(client.released).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// 4.4 → Property 15
// ===========================================================================
describe('Property 15: Postcondición atómica de creación de Asignacion (Req 7.3, 14.1)', () => {
  // Feature: mejora-integral-inventario, Property 15: Para toda creación exitosa de una Asignacion, al finalizar la operación el Activo SHALL tener estado `Asignado`, su `rut_responsable` SHALL ser igual al RUT del Colaborador, y SHALL existir una entrada de Historial de tipo `asignacion` para ese Activo.
  it('deja estado Asignado, rut_responsable=rut y registra historial asignacion', async () => {
    await fc.assert(
      fc.asyncProperty(genSerie, genRut, fc.string({ maxLength: 40 }), async (serie, rut, notas) => {
        const estadoPrevio = 'Disponible';
        const client = makeClient((text, params) => {
          if (/FROM activos WHERE serie/i.test(text)) return { rows: [{ serie, estado: estadoPrevio }] };
          if (/FROM colaboradores WHERE rut/i.test(text)) return { rows: [{ rut }] };
          if (/FROM asignaciones WHERE serie_activo .* estado = 'activa'/is.test(text)) return { rows: [] };
          if (/INSERT INTO asignaciones/i.test(text)) {
            return { rows: [{ id: 42, serie_activo: params[0], rut_colaborador: params[1], estado: 'activa' }] };
          }
          return { rows: [] };
        });
        pool.connect.mockResolvedValue(client);

        const asignacion = await crearAsignacion({ serie_activo: serie, rut_colaborador: rut, notas });

        // El activo pasa a 'Asignado' con rut_responsable = rut del colaborador.
        const updateActivo = findCall(client, /UPDATE activos SET estado = 'Asignado', rut_responsable/i);
        expect(updateActivo).toBeDefined();
        expect(updateActivo.params[0]).toBe(rut); // rut_responsable
        expect(updateActivo.params[1]).toBe(serie); // serie objetivo

        // Existe una entrada de historial de tipo 'asignacion' para ese activo.
        const histInsert = findCall(client, /INSERT INTO historial_activos[\s\S]*'asignacion'/i);
        expect(histInsert).toBeDefined();
        expect(histInsert.params[0]).toBe(serie); // serie
        expect(histInsert.params[1]).toBe(rut); // rut_nuevo

        // Operación confirmada, no revertida.
        expect(countCalls(client, /^COMMIT/i)).toBe(1);
        expect(countCalls(client, /^ROLLBACK/i)).toBe(0);
        expect(asignacion.estado).toBe('activa');
        expect(asignacion.rut_colaborador).toBe(rut);
      }),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// 4.6 → Property 16
// ===========================================================================
describe('Property 16: Postcondición atómica de cierre de Asignacion (Req 8.1, 14.2)', () => {
  // Feature: mejora-integral-inventario, Property 16: Para todo cierre exitoso de una Asignacion `activa`, al finalizar la operación el Activo SHALL quedar sin responsable (`rut_responsable` nulo), con el estado físico registrado en la devolución, y SHALL existir una entrada de Historial de tipo `devolucion`.
  it('deja el activo sin responsable, con estado físico registrado y historial devolucion', async () => {
    await fc.assert(
      fc.asyncProperty(genSerie, genRut, genEstadoFisico, async (serie, rut, estadoFisico) => {
        const client = makeClient((text, params) => {
          if (/FROM asignaciones a[\s\S]*estado = 'activa'/i.test(text)) {
            // Sin correo del colaborador → cierre directo (no aplica token aquí).
            return { rows: [{ id: 7, serie_activo: serie, rut_colaborador: rut, colaborador_correo: null }] };
          }
          if (/UPDATE asignaciones SET/i.test(text)) {
            return { rows: [{ id: 7, serie_activo: serie, estado: params[6] }] };
          }
          return { rows: [] };
        });
        pool.connect.mockResolvedValue(client);

        await cerrarAsignacion({
          serie_activo: serie,
          estado_fisico_devolucion: estadoFisico,
        });

        // El activo queda sin responsable (NULL) con el estado físico registrado.
        const updateActivo = findCall(client, /UPDATE activos SET rut_responsable = NULL, estado/i);
        expect(updateActivo).toBeDefined();
        expect(updateActivo.params[0]).toBe(estadoFisico);
        expect(updateActivo.params[1]).toBe(serie);

        // Existe una entrada de historial de tipo 'devolucion'.
        const histInsert = findCall(client, /INSERT INTO historial_activos[\s\S]*'devolucion'/i);
        expect(histInsert).toBeDefined();
        expect(histInsert.params[0]).toBe(serie); // serie
        expect(histInsert.params[1]).toBe(rut); // rut_anterior
        expect(histInsert.params[2]).toBe(estadoFisico); // estado_nuevo

        expect(countCalls(client, /^COMMIT/i)).toBe(1);
        expect(countCalls(client, /^ROLLBACK/i)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// 4.7 → Property 18
// ===========================================================================
describe('Property 18: Generación condicional de Token_Confirmacion al cerrar (Req 8.3, 8.4)', () => {
  // Feature: mejora-integral-inventario, Property 18: Para todo cierre con correo (del colaborador o alterno) la Asignacion SHALL quedar `pendiente_firma` con Token_Confirmacion no nulo con vigencia 72h; y para todo cierre sin correo alguno la Asignacion SHALL quedar `cerrada` sin token.
  it('con correo → pendiente_firma + token vigente 72h; sin correo → cerrada sin token', async () => {
    await fc.assert(
      fc.asyncProperty(
        genSerie,
        genRut,
        // (correoColaborador | null, correoAlterno | null)
        fc.record({
          correoColaborador: fc.option(fc.emailAddress(), { nil: null }),
          correoAlterno: fc.option(fc.emailAddress(), { nil: null }),
        }),
        async (serie, rut, { correoColaborador, correoAlterno }) => {
          let capturedUpdateParams = null;
          const client = makeClient((text, params) => {
            if (/FROM asignaciones a[\s\S]*estado = 'activa'/i.test(text)) {
              return { rows: [{ id: 9, serie_activo: serie, rut_colaborador: rut, colaborador_correo: correoColaborador }] };
            }
            if (/UPDATE asignaciones SET/i.test(text)) {
              capturedUpdateParams = params;
              // params: [motivo, estadoFisico, desvincular, token, tokenExpira, confirmadoVia, estado, id]
              return { rows: [{ id: 9, serie_activo: serie, estado: params[6], token_confirmacion: params[3], token_expira_at: params[4] }] };
            }
            return { rows: [] };
          });
          pool.connect.mockResolvedValue(client);

          const before = Date.now();
          const { asignacion, token } = await cerrarAsignacion({
            serie_activo: serie,
            correo_alterno: correoAlterno,
          });
          const after = Date.now();

          const hayCorreo = !!(correoColaborador || correoAlterno);
          const estado = capturedUpdateParams[6];
          const tokenParam = capturedUpdateParams[3];
          const expiraParam = capturedUpdateParams[4];

          if (hayCorreo) {
            expect(estado).toBe('pendiente_firma');
            expect(tokenParam).toBeTruthy();
            expect(token).toBeTruthy();
            // Vigencia 72h desde su generación.
            const ttl = new Date(expiraParam).getTime();
            const min = before + 72 * 60 * 60 * 1000 - 1000;
            const max = after + 72 * 60 * 60 * 1000 + 1000;
            expect(ttl).toBeGreaterThanOrEqual(min);
            expect(ttl).toBeLessThanOrEqual(max);
          } else {
            expect(estado).toBe('cerrada');
            expect(tokenParam).toBeNull();
            expect(expiraParam).toBeNull();
            expect(token).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// 4.8 → Property 32
// ===========================================================================
describe('Property 32: Marca de colaborador inactivo al desvincular en cierre (Req 14.4)', () => {
  // Feature: mejora-integral-inventario, Property 32: Para todo cierre de Asignacion con la opción de desvinculación activada, al finalizar la operación el Colaborador SHALL quedar marcado como inactivo dentro de la misma transacción del cierre.
  it('con desvincular_colaborador marca colaborador activo=false en la misma transacción (antes de COMMIT)', async () => {
    await fc.assert(
      fc.asyncProperty(genSerie, genRut, fc.boolean(), async (serie, rut, desvincular) => {
        const client = makeClient((text, params) => {
          if (/FROM asignaciones a[\s\S]*estado = 'activa'/i.test(text)) {
            return { rows: [{ id: 3, serie_activo: serie, rut_colaborador: rut, colaborador_correo: null }] };
          }
          if (/UPDATE asignaciones SET/i.test(text)) {
            return { rows: [{ id: 3, serie_activo: serie, estado: params[6] }] };
          }
          return { rows: [] };
        });
        pool.connect.mockResolvedValue(client);

        await cerrarAsignacion({
          serie_activo: serie,
          desvincular_colaborador: desvincular,
        });

        const desvincularCall = findCall(client, /UPDATE colaboradores SET activo = false/i);
        if (desvincular) {
          expect(desvincularCall).toBeDefined();
          expect(desvincularCall.params[0]).toBe(rut);
          // Dentro de la misma transacción: el UPDATE ocurre antes del COMMIT.
          const idxUpdate = client.calls.findIndex((c) => /UPDATE colaboradores SET activo = false/i.test(c.text));
          const idxCommit = client.calls.findIndex((c) => /^COMMIT/i.test(c.text));
          expect(idxUpdate).toBeGreaterThanOrEqual(0);
          expect(idxCommit).toBeGreaterThan(idxUpdate);
        } else {
          expect(desvincularCall).toBeUndefined();
        }
        expect(countCalls(client, /^COMMIT/i)).toBe(1);
      }),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// 4.9 → Property 17
// ===========================================================================
describe('Property 17: Rollback total ante fallo (Req 7.4, 8.2, 14.5)', () => {
  // Feature: mejora-integral-inventario, Property 17: Para toda operación de creación o cierre de Asignacion en la que cualquier paso falle, el estado del Activo, de la Asignacion y del Colaborador SHALL quedar idéntico al estado previo (todo o nada).
  it('crearAsignacion: fallo en un paso arbitrario ejecuta ROLLBACK y no COMMIT', async () => {
    await fc.assert(
      fc.asyncProperty(genSerie, genRut, fc.integer({ min: 0, max: 4 }), async (serie, rut, failAtIndex) => {
        const client = makeClient(
          (text, params) => {
            if (/FROM activos WHERE serie/i.test(text)) return { rows: [{ serie, estado: 'Disponible' }] };
            if (/FROM colaboradores WHERE rut/i.test(text)) return { rows: [{ rut }] };
            if (/FROM asignaciones WHERE serie_activo .* estado = 'activa'/is.test(text)) return { rows: [] };
            if (/INSERT INTO asignaciones/i.test(text)) return { rows: [{ id: 1, serie_activo: params[0], rut_colaborador: params[1] }] };
            return { rows: [] };
          },
          { failAtIndex, failError: new Error('fallo transaccional inyectado') }
        );
        pool.connect.mockResolvedValue(client);

        let threw = false;
        try {
          await crearAsignacion({ serie_activo: serie, rut_colaborador: rut });
        } catch (e) {
          threw = true;
        }

        expect(threw).toBe(true);
        expect(countCalls(client, /^ROLLBACK/i)).toBe(1);
        expect(countCalls(client, /^COMMIT/i)).toBe(0);
        expect(client.released).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('cerrarAsignacion: fallo en un paso arbitrario ejecuta ROLLBACK y no COMMIT', async () => {
    await fc.assert(
      fc.asyncProperty(genSerie, genRut, fc.integer({ min: 0, max: 3 }), async (serie, rut, failAtIndex) => {
        const client = makeClient(
          (text, params) => {
            if (/FROM asignaciones a[\s\S]*estado = 'activa'/i.test(text)) {
              return { rows: [{ id: 5, serie_activo: serie, rut_colaborador: rut, colaborador_correo: null }] };
            }
            if (/UPDATE asignaciones SET/i.test(text)) return { rows: [{ id: 5, serie_activo: serie, estado: params[6] }] };
            return { rows: [] };
          },
          { failAtIndex, failError: new Error('fallo transaccional inyectado') }
        );
        pool.connect.mockResolvedValue(client);

        let threw = false;
        try {
          await cerrarAsignacion({ serie_activo: serie, desvincular_colaborador: true });
        } catch (e) {
          threw = true;
        }

        expect(threw).toBe(true);
        expect(countCalls(client, /^ROLLBACK/i)).toBe(1);
        expect(countCalls(client, /^COMMIT/i)).toBe(0);
        expect(client.released).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// 4.11 → Property 19 / 20 / 21
// ===========================================================================
describe('Property 19/20/21: Confirmación de Firma_Digital (Req 8.5, 8.6, 8.7)', () => {
  // Feature: mejora-integral-inventario, Property 19: Para toda Asignacion en estado `pendiente_firma` con Token_Confirmacion vigente, acceder al enlace SHALL registrar la confirmación, cambiar a `cerrada` e invalidar el token (segundo acceso → 404).
  it('Property 19: token vigente confirma (estado cerrada) e invalida el token', async () => {
    await fc.assert(
      fc.asyncProperty(fc.hexaString({ minLength: 8, maxLength: 64 }), async (token) => {
        const futuro = new Date(Date.now() + 60 * 60 * 1000); // vigente (1h)
        const client = makeClient((text, params) => {
          if (/FROM asignaciones a[\s\S]*token_confirmacion = \$1[\s\S]*estado = 'pendiente_firma'/i.test(text)) {
            return { rows: [{ id: 11, token_expira_at: futuro, colaborador_nombre: 'X', marca: 'M', modelo: 'D' }] };
          }
          if (/UPDATE asignaciones SET[\s\S]*estado = 'cerrada'[\s\S]*token_confirmacion = NULL/i.test(text)) {
            return { rows: [{ id: 11, estado: 'cerrada', token_confirmacion: null }] };
          }
          return { rows: [] };
        });
        pool.connect.mockResolvedValue(client);

        const res = await confirmarFirma(token);

        expect(res.estado).toBe('cerrada');
        // El UPDATE invalida el token (token_confirmacion = NULL).
        const upd = findCall(client, /UPDATE asignaciones SET[\s\S]*token_confirmacion = NULL/i);
        expect(upd).toBeDefined();
        expect(res.token_confirmacion).toBeNull();
        expect(countCalls(client, /^COMMIT/i)).toBe(1);
        expect(countCalls(client, /^ROLLBACK/i)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: mejora-integral-inventario, Property 20: Para todo Token_Confirmacion inexistente o ya utilizado, el acceso al enlace SHALL responder 404 y no SHALL modificar el estado de ninguna Asignacion.
  it('Property 20: token inexistente/usado → 404 sin modificar estado', async () => {
    await fc.assert(
      fc.asyncProperty(fc.hexaString({ minLength: 8, maxLength: 64 }), async (token) => {
        const client = makeClient((text) => {
          // No hay fila en pendiente_firma para ese token (inexistente o ya usado).
          if (/FROM asignaciones a[\s\S]*estado = 'pendiente_firma'/i.test(text)) return { rows: [] };
          return { rows: [] };
        });
        pool.connect.mockResolvedValue(client);

        let error;
        try {
          await confirmarFirma(token);
        } catch (e) {
          error = e;
        }

        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(404);
        // No se ejecutó ningún UPDATE de estado.
        expect(countCalls(client, /UPDATE asignaciones SET/i)).toBe(0);
        expect(countCalls(client, /^ROLLBACK/i)).toBe(1);
        expect(countCalls(client, /^COMMIT/i)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: mejora-integral-inventario, Property 21: Para todo Token_Confirmacion cuya vigencia de 72 horas haya expirado, el acceso al enlace SHALL responder 410 y no SHALL modificar el estado de ninguna Asignacion.
  it('Property 21: token vencido → 410 sin modificar estado', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.hexaString({ minLength: 8, maxLength: 64 }),
        fc.integer({ min: 1, max: 1000 }),
        async (token, horasVencido) => {
          const pasado = new Date(Date.now() - horasVencido * 60 * 60 * 1000);
          const client = makeClient((text) => {
            if (/FROM asignaciones a[\s\S]*estado = 'pendiente_firma'/i.test(text)) {
              return { rows: [{ id: 12, token_expira_at: pasado, colaborador_nombre: 'X', marca: 'M', modelo: 'D' }] };
            }
            return { rows: [] };
          });
          pool.connect.mockResolvedValue(client);

          let error;
          try {
            await confirmarFirma(token);
          } catch (e) {
            error = e;
          }

          expect(error).toBeInstanceOf(ApiError);
          expect(error.status).toBe(410);
          expect(countCalls(client, /UPDATE asignaciones SET/i)).toBe(0);
          expect(countCalls(client, /^ROLLBACK/i)).toBe(1);
          expect(countCalls(client, /^COMMIT/i)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// 4.13 → Property 12
// ===========================================================================
describe('Property 12: Filtros combinados de Asignaciones (Req 6.3)', () => {
  // Feature: mejora-integral-inventario, Property 12: Para todo conjunto de Asignaciones y toda combinación de filtros por estado, serie de Activo y RUT de Colaborador, el resultado SHALL contener exactamente las Asignaciones que satisfacen todos los filtros aplicados (conjunción).
  it('construye WHERE con AND sobre exactamente los filtros provistos, en orden estado→serie→rut', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          estado: fc.option(fc.constantFrom('activa', 'cerrada', 'pendiente_firma'), { nil: undefined }),
          serie: fc.option(genSerie, { nil: undefined }),
          rut: fc.option(genRut, { nil: undefined }),
        }),
        async (filtros) => {
          let capturedText = '';
          let capturedParams = [];
          pool.query.mockImplementation(async (text, params) => {
            capturedText = String(text);
            capturedParams = params;
            return { rows: [] };
          });

          await getAsignaciones(filtros);

          const provided = [];
          if (filtros.estado) provided.push({ col: 'a.estado', val: filtros.estado });
          if (filtros.serie) provided.push({ col: 'a.serie_activo', val: filtros.serie });
          if (filtros.rut) provided.push({ col: 'a.rut_colaborador', val: filtros.rut });

          if (provided.length === 0) {
            // Sin filtros: no debe haber cláusula WHERE.
            expect(/\bWHERE\b/i.test(capturedText)).toBe(false);
          } else {
            expect(/\bWHERE\b/i.test(capturedText)).toBe(true);
            // Conjunción: hay exactamente (n-1) conectores AND entre condiciones.
            const whereSegment = capturedText.split(/\bWHERE\b/i)[1].split(/ORDER BY/i)[0];
            const andCount = (whereSegment.match(/\bAND\b/gi) || []).length;
            expect(andCount).toBe(provided.length - 1);
            // Cada columna filtrada aparece con su placeholder correspondiente.
            provided.forEach(({ col }, i) => {
              expect(whereSegment).toContain(`${col} = $${i + 1}`);
            });
          }

          // Los parámetros de filtro (en orden) preceden a limit/offset.
          provided.forEach(({ val }, i) => {
            expect(capturedParams[i]).toBe(val);
          });
          // limit y offset se anexan al final.
          expect(capturedParams).toHaveLength(provided.length + 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
