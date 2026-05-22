const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Definición de herramientas disponibles para el agente ────────────────────

const TOOLS = [
  {
    name: 'buscar_activos',
    description: 'Busca activos/equipos en el inventario. Puede filtrar por tipo, estado, marca, modelo, área, serie, IMEI, SIM, etc. Úsala para inspeccionar equipos antes de modificarlos.',
    input_schema: {
      type: 'object',
      properties: {
        tipo_dispositivo: { type: 'string', description: 'Filtrar por tipo: Laptop, Desktop, Smartphone, Tablet, Impresora, SIM Card, Monitor, Servidor, Otro' },
        estado:           { type: 'string', description: 'Filtrar por estado: Asignado, Disponible, Mantenimiento, Descartado' },
        marca:            { type: 'string', description: 'Filtrar por marca (búsqueda parcial)' },
        modelo:           { type: 'string', description: 'Filtrar por modelo (búsqueda parcial)' },
        busqueda_libre:   { type: 'string', description: 'Búsqueda de texto libre en serie, marca, modelo, responsable, ubicación, IMEI, SIM' },
      },
    },
  },
  {
    name: 'actualizar_activo',
    description: 'Actualiza uno o más campos de un activo específico identificado por su serie. Úsalo para recategorizar tipo, cambiar estado, corregir marca/modelo, actualizar ubicación u observaciones.',
    input_schema: {
      type: 'object',
      properties: {
        serie:            { type: 'string',  description: 'Número de serie del activo a modificar (requerido)' },
        tipo_dispositivo: { type: 'string',  description: 'Nuevo tipo: Laptop, Desktop, Smartphone, Tablet, Impresora, SIM Card, Monitor, Servidor, Otro' },
        estado:           { type: 'string',  description: 'Nuevo estado: Asignado, Disponible, Mantenimiento, Descartado' },
        marca:            { type: 'string',  description: 'Nueva marca' },
        modelo:           { type: 'string',  description: 'Nuevo modelo' },
        ubicacion:        { type: 'string',  description: 'Nueva ubicación' },
        observaciones:    { type: 'string',  description: 'Nuevas observaciones' },
      },
      required: ['serie'],
    },
  },
  {
    name: 'obtener_resumen',
    description: 'Devuelve un resumen estadístico del inventario: totales por tipo, por estado, top colaboradores, duplicados detectados.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'listar_colaboradores',
    description: 'Lista los colaboradores registrados. Puede filtrar por área o buscar por nombre o RUT.',
    input_schema: {
      type: 'object',
      properties: {
        busqueda: { type: 'string', description: 'Buscar por nombre o RUT' },
        area:     { type: 'string', description: 'Filtrar por área' },
      },
    },
  },
];

// ─── Ejecución de herramientas ────────────────────────────────────────────────

async function ejecutarHerramienta(nombre, input) {
  switch (nombre) {

    case 'buscar_activos': {
      const { rows } = await db.query(
        `SELECT a.serie, a.marca, a.modelo, a.tipo_dispositivo, a.estado,
                a.ubicacion, a.imei, a.numero_sim, a.numero_telefono,
                a.observaciones, c.nombre AS responsable, c.area
         FROM v_activos a
         LEFT JOIN colaboradores c ON c.rut = a.rut_responsable
         WHERE a.activo = true
           AND ($1::text IS NULL OR a.tipo_dispositivo = $1)
           AND ($2::text IS NULL OR a.estado = $2)
           AND ($3::text IS NULL OR a.marca ILIKE '%' || $3 || '%')
           AND ($4::text IS NULL OR a.modelo ILIKE '%' || $4 || '%')
           AND ($5::text IS NULL OR (
             a.serie ILIKE '%' || $5 || '%' OR
             a.marca ILIKE '%' || $5 || '%' OR
             a.modelo ILIKE '%' || $5 || '%' OR
             c.nombre ILIKE '%' || $5 || '%' OR
             a.ubicacion ILIKE '%' || $5 || '%' OR
             a.imei ILIKE '%' || $5 || '%' OR
             a.numero_sim ILIKE '%' || $5 || '%'
           ))
         ORDER BY a.tipo_dispositivo, a.marca
         LIMIT 100`,
        [
          input.tipo_dispositivo || null,
          input.estado || null,
          input.marca || null,
          input.modelo || null,
          input.busqueda_libre || null,
        ]
      );
      return { total: rows.length, activos: rows };
    }

    case 'actualizar_activo': {
      const { serie, ...campos } = input;
      const permitidos = ['tipo_dispositivo', 'estado', 'marca', 'modelo', 'ubicacion', 'observaciones'];
      const updates = Object.entries(campos).filter(([k]) => permitidos.includes(k));

      if (updates.length === 0) return { error: 'No se especificaron campos a actualizar' };

      const sets   = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
      const values = updates.map(([, v]) => v);

      const { rowCount } = await db.query(
        `UPDATE activos SET ${sets}, updated_at = NOW() WHERE serie = $1`,
        [serie, ...values]
      );

      if (rowCount === 0) return { error: `No se encontró el activo con serie "${serie}"` };
      return { ok: true, serie, cambios: Object.fromEntries(updates) };
    }

    case 'obtener_resumen': {
      const [porTipo, porEstado, totales] = await Promise.all([
        db.query(`SELECT tipo_dispositivo, COUNT(*) AS cantidad
                  FROM activos WHERE activo = true
                  GROUP BY tipo_dispositivo ORDER BY cantidad DESC`),
        db.query(`SELECT estado, COUNT(*) AS cantidad
                  FROM activos WHERE activo = true
                  GROUP BY estado`),
        db.query(`SELECT COUNT(*) AS total FROM activos WHERE activo = true`),
      ]);
      return {
        total: parseInt(totales.rows[0].total),
        por_tipo:   porTipo.rows,
        por_estado: porEstado.rows,
      };
    }

    case 'listar_colaboradores': {
      const { rows } = await db.query(
        `SELECT rut, nombre, area, cargo, correo
         FROM colaboradores
         WHERE activo = true
           AND ($1::text IS NULL OR (nombre ILIKE '%' || $1 || '%' OR rut ILIKE '%' || $1 || '%'))
           AND ($2::text IS NULL OR area = $2)
         ORDER BY nombre
         LIMIT 50`,
        [input.busqueda || null, input.area || null]
      );
      return { total: rows.length, colaboradores: rows };
    }

    default:
      return { error: `Herramienta desconocida: ${nombre}` };
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un asistente de inventario TI para Domino's Pizza Chile.
Ayudas a gestionar equipos tecnológicos (laptops, smartphones, SIM cards, etc.) usando las herramientas disponibles.

Reglas:
- Siempre consulta antes de modificar. Usa buscar_activos para ver qué existe antes de hacer cambios.
- Cuando recategorizas equipos en lote, explica tu criterio de clasificación.
- Para recategorizar "Otro", analiza marca y modelo: HP/Dell/Lenovo/Apple MacBook → Laptop; iPhone/Samsung/Motorola → Smartphone; tarjetas SIM/ICCID → SIM Card; monitores/pantallas → Monitor; impresoras → Impresora.
- Informa siempre cuántos equipos modificaste y un resumen de los cambios.
- Si no estás seguro del tipo correcto de un equipo, déjalo como "Otro" y coméntalo.
- Responde siempre en español.`;

// ─── Loop del agente ──────────────────────────────────────────────────────────

async function ejecutarAgente(mensajes) {
  const historial = [...mensajes];

  // Límite de iteraciones para evitar loops infinitos
  for (let i = 0; i < 10; i++) {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      tools:      TOOLS,
      messages:   historial,
    });

    historial.push({ role: 'assistant', content: response.content });

    // Si el modelo terminó de responder, devolvemos el texto final
    if (response.stop_reason === 'end_turn') {
      const texto = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');
      return { respuesta: texto, historial };
    }

    // Si hay llamadas a herramientas, las ejecutamos todas en paralelo
    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(b => b.type === 'tool_use');

      const resultados = await Promise.all(
        toolUses.map(async (tool) => {
          const resultado = await ejecutarHerramienta(tool.name, tool.input);
          return {
            type:        'tool_result',
            tool_use_id: tool.id,
            content:     JSON.stringify(resultado),
          };
        })
      );

      historial.push({ role: 'user', content: resultados });
    }
  }

  return { respuesta: 'El agente alcanzó el límite de iteraciones.', historial };
}

module.exports = { ejecutarAgente };
