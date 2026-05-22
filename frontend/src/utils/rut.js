// Elimina puntos y asegura formato XXXXXXXX-X
export const normalizeRut = (raw = '') => {
  let clean = raw.replace(/\./g, '').replace(/[^0-9kK-]/g, '').toUpperCase();
  if (!clean.includes('-') && clean.length > 1) {
    clean = clean.slice(0, -1) + '-' + clean.slice(-1);
  }
  return clean;
};

// Valida dígito verificador del RUT chileno
export const validarRut = (rut) => {
  const clean = rut.replace(/\./g, '').toUpperCase();
  if (!/^\d{1,8}-[\dK]$/.test(clean)) return false;
  const [body, dv] = clean.split('-');
  const digits = body.split('').reverse();
  let sum = 0;
  let factor = 2;
  for (const d of digits) {
    sum += parseInt(d) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const expected = 11 - (sum % 11);
  const expectedDv = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
  return dv === expectedDv;
};
