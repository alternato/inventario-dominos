const request = require('supertest');
const bcrypt = require('bcryptjs');
const fc = require('fast-check');

// Denylist en memoria que respalda revocarSesion/sesionRevocada durante las
// pruebas. Emula la tabla `sesiones_revocadas` (jti → expira_at) sin BD real.
const mockDenylistRevocadas = new Map();

// Mock db before loading app
jest.mock('../db', () => ({
  getUsuarioByEmail: jest.fn(),
  getUsuarios: jest.fn(),
  createUsuario: jest.fn(),
  updatePasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  // Denylist de sesiones (Req. 11.5): escribe/lee de un Map en memoria.
  revocarSesion: jest.fn(async (jti, expiraAt) => {
    if (!mockDenylistRevocadas.has(jti)) mockDenylistRevocadas.set(jti, expiraAt);
  }),
  sesionRevocada: jest.fn(async (jti) => {
    if (!jti || !mockDenylistRevocadas.has(jti)) return false;
    // Solo cuenta como revocada si aún no venció (paridad con la implementación).
    return mockDenylistRevocadas.get(jti) > new Date();
  }),
  limpiarSesionesRevocadas: jest.fn(async () => {
    let eliminadas = 0;
    const ahora = new Date();
    for (const [jti, expiraAt] of mockDenylistRevocadas) {
      if (expiraAt <= ahora) {
        mockDenylistRevocadas.delete(jti);
        eliminadas += 1;
      }
    }
    return eliminadas;
  }),
}));

jest.mock('../mail', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../msValidator', () => ({
  verifyMsToken: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret-key-for-jest';
process.env.NODE_ENV = 'test';

const app = require('../app');
const db = require('../db');

describe('POST /api/auth/login', () => {
  // Must satisfy passwordSchema: min 8, uppercase, number, special char
  const VALID_PASSWORD = 'Test@1234!';
  const hashedPassword = bcrypt.hashSync(VALID_PASSWORD, 10);

  beforeEach(() => {
    db.getUsuarioByEmail.mockReset();
  });

  it('returns 401 when user does not exist', async () => {
    db.getUsuarioByEmail.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@dominospizza.cl', password: VALID_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/incorrectos/i);
  });

  it('returns 401 when user is inactive', async () => {
    db.getUsuarioByEmail.mockResolvedValue({
      id: 1, email: 'user@dominospizza.cl', nombre: 'Test', rol: 'viewer',
      password: hashedPassword, activo: false,
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@dominospizza.cl', password: VALID_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('returns 401 when password is wrong', async () => {
    db.getUsuarioByEmail.mockResolvedValue({
      id: 1, email: 'user@dominospizza.cl', nombre: 'Test', rol: 'viewer',
      password: hashedPassword, activo: true,
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@dominospizza.cl', password: 'Wrong@Pass1!' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and sets cookie on valid credentials', async () => {
    db.getUsuarioByEmail.mockResolvedValue({
      id: 1, email: 'user@dominospizza.cl', nombre: 'Test User', rol: 'viewer',
      password: hashedPassword, activo: true,
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@dominospizza.cl', password: VALID_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.usuario.email).toBe('user@dominospizza.cl');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/authToken/);
  });

  it('returns 400 on invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'pass' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/verify', () => {
  it('returns 401 without cookie', async () => {
    const res = await request(app).get('/api/auth/verify');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid JWT', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Cookie', 'authToken=invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid JWT', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: 1, email: 'user@dominospizza.cl', nombre: 'Test', rol: 'viewer' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Cookie', `authToken=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.usuario.email).toBe('user@dominospizza.cl');
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the auth cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie']?.[0] || '';
    expect(cookie).toMatch(/authToken=;/);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('returns generic message even when user does not exist', async () => {
    db.getUsuarioByEmail.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@dominospizza.cl' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/si el email existe/i);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// Property-Based Test (fast-check, ≥100 iteraciones)
// ─────────────────────────────────────────────────────────────

describe('Revocación de sesión tras logout (PBT)', () => {
  const express = require('express');
  const cookieParser = require('cookie-parser');
  const jwt = require('jsonwebtoken');
  const crypto = require('crypto');
  const db = require('../db');
  const { authenticate } = require('../middleware');

  // App protegida mínima que usa el middleware `authenticate` REAL. La ruta
  // /protegida solo responde 200 si `authenticate` deja pasar la solicitud.
  // El manejador de errores traduce ApiError.unauthorized (status 401) a 401.
  const buildProtectedApp = () => {
    const app = express();
    app.use(cookieParser());
    app.get('/protegida', authenticate, (req, res) => {
      res.status(200).json({ ok: true, user: req.user });
    });
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      const status = err.status || 500;
      res.status(status).json({ error: { type: err.type, message: err.message } });
    });
    return app;
  };

  // Emula el efecto de servidor de POST /api/auth/logout: decodifica el token
  // y registra su `jti` en la denylist (db.revocarSesion), igual que auth.js.
  const logout = async (token) => {
    const decoded = jwt.decode(token);
    if (decoded && decoded.jti && decoded.exp) {
      await db.revocarSesion(decoded.jti, new Date(decoded.exp * 1000));
    }
  };

  beforeEach(() => {
    mockDenylistRevocadas.clear();
  });

  // Feature: mejora-integral-inventario, Property 27: Revocación de sesión tras logout
  // Valida: Requisitos 11.5
  // Round-trip: emitir → usar (200) → logout → reusar (401).
  it('para todo token válido: usar→200, logout, reusar→401', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.integer({ min: 1, max: 1_000_000 }),
          email: fc.emailAddress(),
          nombre: fc.string({ minLength: 1, maxLength: 40 }),
          rol: fc.constantFrom('viewer', 'admin', 'superadministrador'),
        }),
        async (usuario) => {
          const app = buildProtectedApp();

          // 1) Emitir un token de sesión válido (con jti, como signToken).
          const token = jwt.sign(
            { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h', jwtid: crypto.randomUUID() }
          );

          // 2) Usar el token antes del logout → 200.
          const resAntes = await request(app)
            .get('/protegida')
            .set('Cookie', `authToken=${token}`);
          expect(resAntes.status).toBe(200);

          // 3) Cerrar sesión (revoca el jti en la denylist).
          await logout(token);

          // 4) Reusar el mismo token tras el logout → 401.
          const resDespues = await request(app)
            .get('/protegida')
            .set('Cookie', `authToken=${token}`);
          expect(resDespues.status).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  });
});

