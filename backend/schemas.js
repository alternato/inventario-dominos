const { z } = require('zod');

// Schemas de validación
const loginSchema = z.object({
  email: z.string().email('Email inválido').refine(
    (email) => email.endsWith('@dominospizza.cl'),
    'Solo emails corporativos @dominospizza.cl permitidos'
  ),
  password: z.string().min(6, 'Contraseña debe tener mínimo 6 caracteres')
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6, 'Contraseña debe tener mínimo 6 caracteres')
});

const createActivoSchema = z.object({
  serie: z.string().min(1, 'Serie requerida').toUpperCase(),
  marca: z.string().min(1, 'Marca requerida'),
  modelo: z.string().min(1, 'Modelo requerido'),
  estado: z.enum(['Asignado', 'Disponible', 'Mantenimiento', 'Descartado']),
  rut_responsable: z.string().min(1, 'RUT requerido'),
  ubicacion: z.string().min(1, 'Ubicación requerida'),
  tipo_dispositivo: z.enum(['Laptop', 'Desktop', 'Smartphone', 'Tablet', 'Impresora', 'Otro']),
  observaciones: z.string().optional(),
  fecha_compra: z.string().optional(),
  valor: z.string().optional(),
  numero_factura: z.string().optional()
});

const createColaboradorSchema = z.object({
  rut: z.string().min(1, 'RUT requerido'),
  nombre: z.string().min(1, 'Nombre requerido'),
  correo: z.string().email('Email inválido'),
  area: z.enum(['Operaciones', 'Administración', 'Logística', 'TI', 'RRHH']),
  cargo: z.string().optional(),
  telefono: z.string().optional()
});

const createUsuarioSchema = z.object({
  email: z.string().email('Email inválido').refine(
    (email) => email.endsWith('@dominospizza.cl'),
    'Solo emails corporativos @dominospizza.cl permitidos'
  ),
  nombre: z.string().min(1, 'Nombre requerido'),
  password: z.string().min(6, 'Contraseña debe tener mínimo 6 caracteres'),
  rol: z.enum(['admin', 'viewer'])
});

module.exports = {
  loginSchema,
  resetPasswordSchema,
  createActivoSchema,
  createColaboradorSchema,
  createUsuarioSchema
};
