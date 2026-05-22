import { describe, test, expect } from 'vitest';
import { validarRut, normalizeRut } from './rut';

describe('validarRut', () => {
  test('1-9 es válido', () => expect(validarRut('1-9')).toBe(true));
  test('6-K es válido', () => expect(validarRut('6-K')).toBe(true));
  test('12345678-5 es válido', () => expect(validarRut('12345678-5')).toBe(true));
  test('DV incorrecto falla', () => expect(validarRut('12345678-0')).toBe(false));
  test('formato sin guion falla', () => expect(validarRut('123456789')).toBe(false));
  test('vacío falla', () => expect(validarRut('')).toBe(false));
});

describe('normalizeRut', () => {
  test('agrega guion antes del último dígito', () => expect(normalizeRut('123456789')).toBe('12345678-9'));
  test('elimina puntos', () => expect(normalizeRut('12.345.678-9')).toBe('12345678-9'));
  test('convierte k a K', () => expect(normalizeRut('6-k')).toBe('6-K'));
  test('respeta guion existente', () => expect(normalizeRut('1-9')).toBe('1-9'));
});
