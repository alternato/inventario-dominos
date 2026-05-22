const { createColaboradorSchema, validarRut } = require('../schemas');

describe('validarRut', () => {
  test('1-9 es válido', () => expect(validarRut('1-9')).toBe(true));
  test('6-K es válido', () => expect(validarRut('6-K')).toBe(true));
  test('12345678-5 es válido', () => expect(validarRut('12345678-5')).toBe(true));
  test('DV incorrecto falla', () => expect(validarRut('12345678-0')).toBe(false));
  test('sin guion falla', () => expect(validarRut('123456785')).toBe(false));
  test('vacío falla', () => expect(validarRut('')).toBe(false));
});

describe('createColaboradorSchema', () => {
  const base = { rut: '1-9', nombre: 'Test User', area: 'TI' };

  test('datos válidos pasan', () => {
    const r = createColaboradorSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  test('RUT con DV incorrecto falla', () => {
    const r = createColaboradorSchema.safeParse({ ...base, rut: '12345678-0' });
    expect(r.success).toBe(false);
    expect(r.error.errors[0].message).toMatch(/inválido/i);
  });

  test('nombre vacío falla', () => {
    const r = createColaboradorSchema.safeParse({ ...base, nombre: '' });
    expect(r.success).toBe(false);
  });
});
