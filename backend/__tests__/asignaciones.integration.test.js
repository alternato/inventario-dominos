/**
 * __tests__/asignaciones.integration.test.js
 *
 * Pruebas de integración de los flujos de Asignación (Tarea 5.4, Req. 13.4).
 *
 * ─── Qué se ejecuta SIEMPRE (sin base de datos real) ────────────────────────
 * Se monta la app Express real (`../app`) y se ataca con `supertest`, pero se
 * mockea la capa de datos (`jest.mock('../db')`) para aislar el *controller*
 * (`routes/asignaciones.js`) + los middlewares (`authenticate`, `requireAdmin`,
 * `validate`) del acceso real a PostgreSQL. Esto valida que:
 *   - Creación:  201 éxito · 409 ya asignado · 404 entidad inexistente · 403 viewer · 401 sin token
 *   - Cierre:    200 con correo · 200 sin correo · 404 activa inexistente · 403 viewer
 *   - Confirmar: 200 token vigente (HTML) · 404 inexistente/usado · 410 vencido
 * Los `ApiError` (409/404/410) lanzados por la capa db mockeada se propagan al
 * manejador central de `app.js`, comprobando que el controller los mapea al
 * código HTTP correcto. `requireAdmin` responde 403 a un viewer antes de tocar
 * la capa db.
 *
 * ─── Qué se ejecuta SOLO si hay una BD de prueba disponible (DB-gated) ───────
 * Un `describe` condicional (`TEST_DATABASE_URL` o `DB_HOST` presentes) que se
 * conecta a PostgreSQL real y, sobre tablas aisladas propias de la prueba
 * (esquema `asig_it_test`), demuestra las garantías a nivel de motor en las que
 * se apoya `db/asignaciones.js`:
 *   1. El índice único parcial `uq_asig_una_activa ON (serie_activo) WHERE
 *      estado='activa'` rechaza una SEGUNDA fila activa con el error 23505.
 *   2. Un `ROLLBACK` real deshace por completo una transacción fallida
 *      (todo-o-nada): tras el rollback no queda ninguna fila.
 * Si no hay BD alcanzable, este bloque se OMITE con `describe.skip`, por lo que
 * la suite pasa igual en entornos sin base de datos (p. ej. CI sin Postgres).
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// La capa de datos completa se mockea: cada método usado por el controller y
// por los middlewares queda como jest.fn(). `sesionRevocada` la consume
// `authenticate`; por defecto devuelve false (sesión vigente).
jest.mock('../db', () => ({
  getAsignaciones: jest.fn(),
  crearAsignacion: jest.fn(),
  cerrarAsignacion: jest.fn(),
  confirmarFirma: jest.fn(),
  getActivoBySerie: jest.fn(),
  getColaboradorByRut: jest.fn(),
  sesionRevocada: jest.fn().mockResolvedValue(false),
}));

// El correo es best-effort y nunca debe bloquear la respuesta: se mockea.
jest.mock('../mail', () => ({
  sendMailAsignacion: jest.fn().mockResolvedValue(undefined),
  sendMailConfirmacionDevolucion: jest.fn().mockResolvedValue(undefined),
}));

// `msValidator` importa `jose` (ESM puro) al cargar `routes/auth` desde `app`.
// Se mockea para evitar el fallo de parseo de ESM en Jest (igual que activos.test.js).
jest.mock('../msValidator', () => ({ verifyMsToken: jest.fn() }));

process.env.JWT_SECRET = 'test-secret-key-for-jest';
process.env.NODE_ENV = 'test';

const app = require('../app');
const db = require('../db');
const { ApiError } = require('../lib/apiError');

// RUT chileno válido (dígito verificador correcto) exigido por `createAsignacionSchema`.
const RUT_VALIDO = '11111111-1';

// Firma un JWT con jti y rol, igual que emite `routes/auth.js`.
const makeToken = (rol = 'viewer') =>
  jwt.sign(
    { id: 1, email: 'u@dominospizza.cl', nombre: 'Test', rol, jti: 'jti-test-1' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

const adminToken = makeToken('admin');
const viewerToken = makeToken('viewer');

beforeEach(() => {
  jest.clearAllMocks();
  // clearMocks borra también la implementación por defecto de sesionRevocada.
  db.sesionRevocada.mockResolvedValue(false);
});

// ===========================================================================
// FLUJO 1 · Creación de Asignación — POST /api/asignaciones
// ===========================================================================
describe('POST /api/asignaciones (creación)', () => {
  const body = { serie_activo: 'SN-INT-1', rut_colaborador: RUT_VALIDO, entregado_por: 'TI' };

  it('401 sin token de autenticación', async () => {
    const res = await request(app).post('/api/asignaciones').send(body);
    expect(res.status).toBe(401);
    expect(db.crearAsignacion).not.toHaveBeenCalled();
  });

  it('403 para un usuario viewer (requireAdmin)', async () => {
    const res = await request(app)
      .post('/api/asignaciones')
      .set('Cookie', `authToken=${viewerToken}`)
      .send(body);
    expect(res.status).toBe(403);
    // El rol se rechaza antes de invocar la capa de datos.
    expect(db.crearAsignacion).not.toHaveBeenCalled();
  });

  it('400 cuando el cuerpo no pasa la validación (RUT inválido)', async () => {
    const res = await request(app)
      .post('/api/asignaciones')
      .set('Cookie', `authToken=${adminToken}`)
      .send({ serie_activo: 'SN-INT-1', rut_colaborador: '123-9' });
    expect(res.status).toBe(400);
    expect(db.crearAsignacion).not.toHaveBeenCalled();
  });

  it('201 en creación exitosa e inyecta usuario_id del token', async () => {
    const creada = { id: 10, serie_activo: 'SN-INT-1', rut_colaborador: RUT_VALIDO, estado: 'activa' };
    db.crearAsignacion.mockResolvedValue(creada);
    db.getActivoBySerie.mockResolvedValue({ serie: 'SN-INT-1', marca: 'Dell', modelo: 'XPS' });
    db.getColaboradorByRut.mockResolvedValue({ rut: RUT_VALIDO, nombre: 'Ana', correo: 'ana@dominospizza.cl' });

    const res = await request(app)
      .post('/api/asignaciones')
      .set('Cookie', `authToken=${adminToken}`)
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 10, estado: 'activa' });
    expect(res.body.message).toMatch(/exitosamente/i);
    // El controller pasa el usuario_id extraído del JWT.
    expect(db.crearAsignacion).toHaveBeenCalledWith(
      expect.objectContaining({ serie_activo: 'SN-INT-1', rut_colaborador: RUT_VALIDO, usuario_id: 1 })
    );
  });

  it('409 cuando el equipo ya está asignado (ApiError.conflict)', async () => {
    db.crearAsignacion.mockRejectedValue(ApiError.conflict('El equipo ya está asignado'));
    const res = await request(app)
      .post('/api/asignaciones')
      .set('Cookie', `authToken=${adminToken}`)
      .send(body);
    expect(res.status).toBe(409);
    expect(res.body.error.type).toBe('CONFLICT');
  });

  it('404 cuando la entidad (activo/colaborador) no existe (ApiError.notFound)', async () => {
    db.crearAsignacion.mockRejectedValue(ApiError.notFound('No existe un activo con serie SN-INT-1'));
    const res = await request(app)
      .post('/api/asignaciones')
      .set('Cookie', `authToken=${adminToken}`)
      .send(body);
    expect(res.status).toBe(404);
    expect(res.body.error.type).toBe('NOT_FOUND');
  });
});

// ===========================================================================
// FLUJO 2 · Cierre de Asignación — PUT /api/asignaciones/:id/cerrar
// ===========================================================================
describe('PUT /api/asignaciones/:id/cerrar (cierre)', () => {
  it('403 para un usuario viewer (requireAdmin)', async () => {
    const res = await request(app)
      .put('/api/asignaciones/7/cerrar')
      .set('Cookie', `authToken=${viewerToken}`)
      .send({ estado_fisico_devolucion: 'Disponible' });
    expect(res.status).toBe(403);
    expect(db.cerrarAsignacion).not.toHaveBeenCalled();
  });

  it('200 cierre exitoso SIN correo (no genera token, no envía correo)', async () => {
    const mail = require('../mail');
    db.cerrarAsignacion.mockResolvedValue({
      asignacion: { id: 7, estado: 'cerrada', serie_activo: 'SN-INT-1' },
      token: null,
      emailDestino: null,
    });

    const res = await request(app)
      .put('/api/asignaciones/7/cerrar')
      .set('Cookie', `authToken=${adminToken}`)
      .send({ estado_fisico_devolucion: 'Disponible' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 7, estado: 'cerrada' });
    expect(mail.sendMailConfirmacionDevolucion).not.toHaveBeenCalled();
    expect(db.cerrarAsignacion).toHaveBeenCalledWith(
      expect.objectContaining({ id: '7', usuario_id: 1 })
    );
  });

  it('200 cierre exitoso CON correo (queda pendiente_firma y dispara correo)', async () => {
    const mail = require('../mail');
    db.cerrarAsignacion.mockResolvedValue({
      asignacion: {
        id: 8,
        estado: 'pendiente_firma',
        serie_activo: 'SN-INT-2',
        rut_colaborador: RUT_VALIDO,
        colaborador_nombre: 'Ana',
        marca: 'Dell',
        modelo: 'XPS',
        confirmado_via: 'corporativo',
      },
      token: 'tok-abc',
      emailDestino: 'ana@dominospizza.cl',
    });

    const res = await request(app)
      .put('/api/asignaciones/8/cerrar')
      .set('Cookie', `authToken=${adminToken}`)
      .send({ correo_alterno: 'ana.personal@gmail.com' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 8, estado: 'pendiente_firma' });
    // Con token + emailDestino el controller envía el correo de confirmación.
    expect(mail.sendMailConfirmacionDevolucion).toHaveBeenCalledTimes(1);
    expect(mail.sendMailConfirmacionDevolucion).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok-abc', emailDestino: 'ana@dominospizza.cl' })
    );
  });

  it('404 cuando no existe una asignación activa (ApiError.notFound)', async () => {
    db.cerrarAsignacion.mockRejectedValue(ApiError.notFound('No existe una asignación activa para cerrar'));
    const res = await request(app)
      .put('/api/asignaciones/999/cerrar')
      .set('Cookie', `authToken=${adminToken}`)
      .send({ estado_fisico_devolucion: 'Disponible' });
    expect(res.status).toBe(404);
    expect(res.body.error.type).toBe('NOT_FOUND');
  });
});

// ===========================================================================
// FLUJO 3 · Confirmación de Firma_Digital — GET /api/asignaciones/confirmar/:token
// (ruta pública, responde SIEMPRE en HTML)
// ===========================================================================
describe('GET /api/asignaciones/confirmar/:token (confirmación de firma)', () => {
  it('200 con HTML de confirmación cuando el token está vigente', async () => {
    db.confirmarFirma.mockResolvedValue({
      id: 11,
      estado: 'cerrada',
      colaborador_nombre: 'Ana',
      marca: 'Dell',
      modelo: 'XPS',
    });

    const res = await request(app).get('/api/asignaciones/confirmar/tok-vigente');
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/html/);
    expect(res.text).toMatch(/Devolución confirmada/i);
    expect(res.text).toContain('Ana');
  });

  it('404 (HTML) cuando el token no existe o ya fue utilizado', async () => {
    db.confirmarFirma.mockRejectedValue(ApiError.notFound('El enlace no es válido o ya fue utilizado'));
    const res = await request(app).get('/api/asignaciones/confirmar/tok-inexistente');
    expect(res.status).toBe(404);
    expect(res.type).toMatch(/html/);
    expect(res.text).toMatch(/Link inválido/i);
  });

  it('410 (HTML) cuando el token está vencido', async () => {
    db.confirmarFirma.mockRejectedValue(ApiError.gone('El enlace de confirmación expiró'));
    const res = await request(app).get('/api/asignaciones/confirmar/tok-vencido');
    expect(res.status).toBe(410);
    expect(res.type).toMatch(/html/);
    expect(res.text).toMatch(/expirado/i);
  });
});

// ===========================================================================
// FLUJO 4 (DB-gated) · Garantías reales de PostgreSQL
// Solo corre si hay una BD de prueba alcanzable; si no, se OMITE limpiamente.
// ===========================================================================
const hasTestDb = !!(process.env.TEST_DATABASE_URL || process.env.DB_HOST);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb('PostgreSQL real: ROLLBACK y uq_asig_una_activa (Req. 13.4, 7.1, 14.1/14.5)', () => {
  const { Pool } = require('pg');
  const SCHEMA = 'asig_it_test';
  let pool;

  beforeAll(async () => {
    pool = process.env.TEST_DATABASE_URL
      ? new Pool({ connectionString: process.env.TEST_DATABASE_URL })
      : new Pool({
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT, 10) || 5432,
          database: process.env.DB_NAME || 'inventario_db',
          user: process.env.DB_USER || 'inventario_user',
          password: process.env.DB_PASSWORD || '',
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 5000,
        });

    // Tablas aisladas en un esquema propio de la prueba: no tocan datos reales.
    await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await pool.query(`CREATE SCHEMA ${SCHEMA}`);
    await pool.query(`
      CREATE TABLE ${SCHEMA}.asignaciones (
        id            SERIAL PRIMARY KEY,
        serie_activo  VARCHAR(100) NOT NULL,
        estado        VARCHAR(20)  NOT NULL DEFAULT 'activa'
      )
    `);
    // Réplica del índice único parcial de producción (design.md / 006_*.sql).
    await pool.query(`
      CREATE UNIQUE INDEX uq_asig_una_activa
      ON ${SCHEMA}.asignaciones(serie_activo) WHERE estado = 'activa'
    `);
  }, 20000);

  afterAll(async () => {
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => {});
      await pool.end();
    }
  });

  it('el índice único parcial rechaza una SEGUNDA asignación activa (código 23505)', async () => {
    const serie = 'SN-DBGATE-1';
    await pool.query(`INSERT INTO ${SCHEMA}.asignaciones (serie_activo, estado) VALUES ($1, 'activa')`, [serie]);

    let err;
    try {
      await pool.query(`INSERT INTO ${SCHEMA}.asignaciones (serie_activo, estado) VALUES ($1, 'activa')`, [serie]);
    } catch (e) {
      err = e;
    }
    // 23505 = unique_violation → la capa db lo traduce a 409 (ApiError.conflict).
    expect(err).toBeDefined();
    expect(err.code).toBe('23505');

    // Una fila 'cerrada' + una 'activa' SÍ coexisten (el índice es parcial).
    await pool.query(`UPDATE ${SCHEMA}.asignaciones SET estado = 'cerrada' WHERE serie_activo = $1`, [serie]);
    await expect(
      pool.query(`INSERT INTO ${SCHEMA}.asignaciones (serie_activo, estado) VALUES ($1, 'activa')`, [serie])
    ).resolves.toBeDefined();

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS activas FROM ${SCHEMA}.asignaciones WHERE serie_activo = $1 AND estado = 'activa'`,
      [serie]
    );
    expect(rows[0].activas).toBe(1);
  });

  it('un ROLLBACK real deshace por completo la transacción (todo-o-nada)', async () => {
    const serie = 'SN-DBGATE-ROLLBACK';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO ${SCHEMA}.asignaciones (serie_activo, estado) VALUES ($1, 'activa')`, [serie]);
      // La fila es visible dentro de la transacción.
      const dentro = await client.query(
        `SELECT COUNT(*)::int AS n FROM ${SCHEMA}.asignaciones WHERE serie_activo = $1`,
        [serie]
      );
      expect(dentro.rows[0].n).toBe(1);
      // Simulamos el fallo de un paso posterior → ROLLBACK.
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    // Tras el rollback no debe quedar rastro de la fila.
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ${SCHEMA}.asignaciones WHERE serie_activo = $1`,
      [serie]
    );
    expect(rows[0].n).toBe(0);
  });
});
