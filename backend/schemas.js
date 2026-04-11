const { z } = require('zod');

// Helper: política de contraseñas robusta (M5)
const passwordSchema = z.string()
  .min(8, 'Contraseña debe tener mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
  .regex(/[0-9]/, 'Debe contener al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial');

// ─── Auth ────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Email inválido').refine(
    (email) => email.endsWith('@dominospizza.cl'),
    'Solo emails corporativos @dominospizza.cl permitidos'
  ),
  password: passwordSchema
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: passwordSchema
});

// ─── Activos ─────────────────────────────────────────────────
const TIPOS_DISPOSITIVO = ['Laptop', 'Desktop', 'Smartphone', 'Tablet', 'Impresora', 'SIM Card', 'Monitor', 'Servidor', 'Otro'];
const ESTADOS_ACTIVO    = ['Asignado', 'Disponible', 'Mantenimiento', 'Descartado'];

const createActivoSchema = z.object({
  serie:            z.string().min(1, 'Serie requerida'),
  marca:            z.string().min(1, 'Marca requerida'),
  modelo:           z.string().min(1, 'Modelo requerido'),
  estado:           z.enum(ESTADOS_ACTIVO, { errorMap: () => ({ message: `Estado debe ser uno de: ${ESTADOS_ACTIVO.join(', ')}` }) }),
  tipo_dispositivo: z.enum(TIPOS_DISPOSITIVO, { errorMap: () => ({ message: `Tipo debe ser uno de: ${TIPOS_DISPOSITIVO.join(', ')}` }) }),
  rut_responsable:  z.string().optional().nullable(),
  ubicacion:        z.string().optional().nullable(),
  observaciones:    z.string().optional().nullable(),
  fecha_compra:     z.string().optional().nullable(),
  valor:            z.union([z.string(), z.number()]).optional().nullable(),
  numero_factura:   z.string().optional().nullable(),
  imei:             z.string().optional().nullable(),
  numero_sim:       z.string().optional().nullable(),
  imsi:             z.string().optional().nullable(),
});

// Para actualizaciones: todos los campos son opcionales
const updateActivoSchema = createActivoSchema.partial().required({ serie: false });

// ─── Colaboradores ───────────────────────────────────────────
const AREAS = ['Operaciones', 'Administración', 'Logística', 'TI', 'RRHH', 'Marketing', 'Otro'];

const createColaboradorSchema = z.object({
  rut:      z.string().min(1, 'RUT requerido'),
  nombre:   z.string().min(1, 'Nombre requerido'),
  correo:   z.string().email('Email inválido').optional().nullable(),
  area:     z.enum(AREAS, { errorMap: () => ({ message: `Área debe ser una de: ${AREAS.join(', ')}` }) }),
  cargo:    z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
});

const updateColaboradorSchema = createColaboradorSchema.partial();

// ─── Usuarios ────────────────────────────────────────────────
const createUsuarioSchema = z.object({
  email:    z.string().email('Email inválido').refine(
    (e) => e.endsWith('@dominospizza.cl'),
    'Solo emails corporativos @dominospizza.cl'
  ),
  nombre:   z.string().min(1, 'Nombre requerido'),
  password: passwordSchema,
  rol:      z.enum(['admin', 'viewer', 'superadministrador']),
});

const updateUsuarioSchema = z.object({
  nombre:   z.string().min(1).optional(),
  email:    z.string().email().optional(),
  rol:      z.enum(['admin', 'viewer', 'superadministrador']).optional(),
  activo:   z.boolean().optional(),
  password: passwordSchema.optional(),
});

// ─── Middleware helper ───────────────────────────────────────
/**
 * Genera un middleware Express que valida req.body contra el schema Zod dado.
 * En caso de error responde 400 con los mensajes de validación.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => e.message);
      return res.status(400).json({ error: errors.join('. ') });
    }
    req.body = result.data; // datos limpios y transformados
    next();
  };
}

module.exports = {
  loginSchema,
  resetPasswordSchema,
  createActivoSchema,
  updateActivoSchema,
  createColaboradorSchema,
  updateColaboradorSchema,
  createUsuarioSchema,
  updateUsuarioSchema,
  validate,
};
