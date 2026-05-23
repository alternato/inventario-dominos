const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../db', () => ({
  getKPIs: jest.fn(),
  buscarGlobal: jest.fn(),
  getHistorial: jest.fn(),
  getUsuarioByEmail: jest.fn(),
}));

jest.mock('../mail', () => ({}));
jest.mock('../msValidator', () => ({ verifyMsToken: jest.fn() }));
jest.mock('../agent', () => ({ ejecutarAgente: jest.fn() }));

process.env.JWT_SECRET = 'test-secret-key-for-jest';
process.env.NODE_ENV = 'test';

const app = require('../app');
const db = require('../db');

const viewerToken = jwt.sign(
  { id: 1, email: 'u@dominospizza.cl', nombre: 'Test', rol: 'viewer' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

describe('GET /health', () => {
  it('returns ok without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/kpis', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/kpis');
    expect(res.status).toBe(401);
  });

  it('returns KPIs for authenticated user', async () => {
    const mockKpis = { totales: { total: 10, asignados: 5 }, porTipo: [], porEstado: [] };
    db.getKPIs.mockResolvedValue(mockKpis);
    const res = await request(app)
      .get('/api/kpis')
      .set('Cookie', `authToken=${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totales.total).toBe(10);
  });
});

describe('GET /api/buscar', () => {
  it('returns 400 when query is too short', async () => {
    const res = await request(app)
      .get('/api/buscar?q=a')
      .set('Cookie', `authToken=${viewerToken}`);
    expect(res.status).toBe(400);
  });

  it('returns results for valid query', async () => {
    db.buscarGlobal.mockResolvedValue({ activos: [], colaboradores: [] });
    const res = await request(app)
      .get('/api/buscar?q=iphone')
      .set('Cookie', `authToken=${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('activos');
    expect(res.body).toHaveProperty('colaboradores');
  });
});

describe('GET /api/historial', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/historial');
    expect(res.status).toBe(401);
  });

  it('returns historial for authenticated user', async () => {
    db.getHistorial.mockResolvedValue([{ id: 1, serie: 'SN001', tipo_movimiento: 'creacion' }]);
    const res = await request(app)
      .get('/api/historial')
      .set('Cookie', `authToken=${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /api/chat', () => {
  it('returns 503 when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await request(app)
      .post('/api/chat')
      .set('Cookie', `authToken=${viewerToken}`)
      .send({ mensajes: [{ role: 'user', content: 'hola' }] });
    expect(res.status).toBe(503);
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/ruta-inexistente');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no encontrada/i);
  });
});
