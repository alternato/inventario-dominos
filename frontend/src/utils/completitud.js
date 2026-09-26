// Cálculo de completitud de un Activo (valor derivado, no persistido).
// Requisitos: 1.5, 2.5 — Diseño: sección "Cálculo de completitud".

// Campos recomendados base, aplicables a todo Activo.
export const CAMPOS_RECOMENDADOS_BASE = [
  'marca',
  'modelo',
  'ubicacion',
  'observaciones',
  'fecha_compra',
  'valor',
  'numero_factura',
];

// Campos recomendados adicionales para dispositivos móviles.
export const CAMPOS_RECOMENDADOS_MOVIL = [
  'imei',
  'numero_sim',
  'imsi',
  'numero_telefono',
  'compania',
];

// Tipos de dispositivo considerados móviles (añaden los campos móviles).
export const TIPOS_MOVILES = ['Smartphone', 'Tablet', 'SIM Card'];

// Normaliza el tipo de dispositivo para comparación insensible a mayúsculas/espacios.
const normalizarTipo = (tipo = '') => String(tipo).trim().toLowerCase();

const TIPOS_MOVILES_NORM = TIPOS_MOVILES.map(normalizarTipo);

// Indica si un tipo de dispositivo es móvil.
export const esTipoMovil = (tipoDispositivo) =>
  TIPOS_MOVILES_NORM.includes(normalizarTipo(tipoDispositivo));

// Devuelve la lista de Campos_Recomendados aplicables según el tipo de dispositivo.
export const camposRecomendados = (tipoDispositivo) =>
  esTipoMovil(tipoDispositivo)
    ? [...CAMPOS_RECOMENDADOS_BASE, ...CAMPOS_RECOMENDADOS_MOVIL]
    : [...CAMPOS_RECOMENDADOS_BASE];

// Considera vacío: undefined, null, o string en blanco tras trim.
const estaVacio = (valor) => {
  if (valor === undefined || valor === null) return true;
  if (typeof valor === 'string') return valor.trim() === '';
  return false;
};

// Calcula el % de Campos_Recomendados no vacíos según el tipo de dispositivo.
// Resultado garantizado en el rango [0, 100]. Si no hay campos aplicables,
// se considera 100% (nada pendiente por completar).
export const calcularCompletitud = (activo = {}) => {
  const campos = camposRecomendados(activo?.tipo_dispositivo);
  if (campos.length === 0) return 100;
  const completos = campos.filter((campo) => !estaVacio(activo?.[campo])).length;
  const porcentaje = (completos / campos.length) * 100;
  return Math.max(0, Math.min(100, Math.round(porcentaje)));
};
