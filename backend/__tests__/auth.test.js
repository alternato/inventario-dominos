const request = require('supertest');
const bcrypt = require('bcryptjs');

// Mock db before loading app
jest.mock('../db', () => ({
  getUsuarioByEmail: jest.fn(),
  getUsuarios: jest.fn(),
  createUsuario: jest.fn(),
  updatePasswordReset: jest.fn(),
  resetPassword: jest.fn(),
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
