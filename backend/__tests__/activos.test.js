const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../db', () => ({
  getActivos: jest.fn(),
  getActivoBySerie: jest.fn(),
  createActivo: jest.fn(),
  updateActivo: jest.fn(),
  deleteActivo: jest.fn(),
  getUsuarioByEmail: jest.fn(),
}));

jest.mock('../mail', () => ({
  sendMissingSignatureAlert: jest.fn(),
  sendStatusEventAlert: jest.fn(),
}));

jest.mock('../msValidator', () => ({ verifyMsToken: jest.fn() }));

process.env.JWT_SECRET = 'test-secret-key-for-jest';
process.env.NODE_ENV = 'test';

const app = require('../app');
const db = require('../db');

const makeToken = (rol = 'viewer') =>
  jwt.sign({ id: 1, email: 'u@dominospizza.cl', nombre: 'Test', rol }, process.env.JWT_SECRET, { expiresIn: '1h' });

const adminToken = makeToken('admin');
const viewerToken = makeToken('viewer');

const mockActivos = [
  { serie: 'SN001', marca: 'Apple', modelo: 'iPhone 14', estado: 'Asignado', tipo_dispositivo: 'Smartphone', colaborador: { nombre: 'Ana' } },
  { serie: 'SN002', marca: 'Samsung', modelo: 'S23', estado: 'Disponible', tipo_dispositivo: 'Smartphone', colaborador: null },
];

describe('GET /api/activos', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/activos');
    expect(res.status).toBe(401);
  });

  it('returns activos list for authenticated user', async () => {
    db.getActivos.mockResolvedValue(mockActivos);
    const res = await request(app)
      .get('/api/activos')
      .set('Cookie', `authToken=${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].serie).toBe('SN001');
  });
});

describe('GET /api/activos/:serie', () => {
  it('returns 404 when activo not found', async () => {
    db.getActivoBySerie.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/activos/NOEXISTE')
      .set('Cookie', `authToken=${viewerToken}`);
    expect(res.status).toBe(404);
  });

  it('returns activo when found', async () => {
    db.getActivoBySerie.mockResolvedValue(mockActivos[0]);
    const res = await request(app)
      .get('/api/activos/SN001')
      .set('Cookie', `authToken=${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.serie).toBe('SN001');
  });
});

describe('POST /api/activos', () => {
  const newActivo = {
    serie: 'SN003', marca: 'Lenovo', modelo: 'ThinkPad', estado: 'Disponible',
    tipo_dispositivo: 'Laptop',
  };

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/activos').send(newActivo);
    expect(res.status).toBe(401);
  });

  it('creates activo for any authenticated user', async () => {
    db.createActivo.mockResolvedValue({ ...newActivo, id: 1 });
    const res = await request(app)
      .post('/api/activos')
      .set('Cookie', `authToken=${viewerToken}`)
      .send(newActivo);
    expect(res.status).toBe(201);
    expect(res.body.serie).toBe('SN003');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/activos')
      .set('Cookie', `authToken=${viewerToken}`)
      .send({ marca: 'Lenovo' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/activos/:serie', () => {
  it('returns 403 for viewer', async () => {
    const res = await request(app)
      .delete('/api/activos/SN001')
      .set('Cookie', `authToken=${viewerToken}`);
    expect(res.status).toBe(403);
  });

  it('soft-deletes activo for admin', async () => {
    db.deleteActivo.mockResolvedValue(undefined);
    const res = await request(app)
      .delete('/api/activos/SN001')
      .set('Cookie', `authToken=${adminToken}`);
    expect(res.status).toBe(200);
    expect(db.deleteActivo).toHaveBeenCalledWith('SN001', 1);
  });
});
