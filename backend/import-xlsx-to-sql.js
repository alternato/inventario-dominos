const XLSX = require('../frontend/node_modules/xlsx');
const fs = require('fs');
const path = require('path');

const esc = (val) => {
  if (val === null || val === undefined || val === '') return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return val;
  return `'${String(val).replace(/'/g, "''")}'`;
};

const mapEstado = (v) => {
  if (!v) return 'Disponible';
  const n = v.toLowerCase();
  if (n.includes('asignado') && !n.includes('no')) return 'Asignado';
  if (n.includes('mantenimiento')) return 'Mantenimiento';
  if (n.includes('descartado') || n.includes('baja')) return 'Descartado';
  return 'Disponible';
};

const normalizeArea = (a) => (a || '').trim().replace(/\s+/g, ' ');

const wb = XLSX.readFile(path.join(__dirname, '../actual.xlsx'));
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

// Recolectar colaboradores únicos (por RUT)
const colabMap = new Map();
for (const row of rows) {
  const rut = (row['Rut'] || '').trim().toUpperCase();
  if (!rut) continue;
  if (!colabMap.has(rut)) {
    colabMap.set(rut, {
      rut,
      nombre: (row['Persona'] || 'Sin nombre').trim(),
      area: normalizeArea(row['Área']) || 'Sin área',
    });
  }
}

let sql = `-- IMPORT desde actual.xlsx (${rows.length} activos, ${colabMap.size} colaboradores)\n`;
sql += `-- Generado: ${new Date().toISOString()}\n\n`;

// Colaboradores
sql += `-- ── COLABORADORES ─────────────────────────────────────────────────────────\n`;
for (const c of colabMap.values()) {
  sql += `INSERT INTO colaboradores (rut, nombre, area, activo) VALUES (${esc(c.rut)}, ${esc(c.nombre)}, ${esc(c.area)}, TRUE) ON CONFLICT (rut) DO UPDATE SET nombre = EXCLUDED.nombre, area = EXCLUDED.area;\n`;
}

sql += `\n-- ── ACTIVOS ───────────────────────────────────────────────────────────────\n`;
let omitidos = 0;
for (const row of rows) {
  const serie = (row['Nº de Serie'] || '').trim();
  if (!serie) { omitidos++; continue; }

  const estado = mapEstado(row['Estado']);
  const rut = (row['Rut'] || '').trim().toUpperCase() || null;

  // Construir notas con info de accesorios
  const extras = [];
  if (row['Mochila'] === true) extras.push('Mochila: Sí');
  if (row['Cargador'] === true) extras.push('Cargador: Sí');
  if (row['Documento Firmado'] === true) extras.push('Documento firmado');
  if (row['Observaciones']) extras.push(row['Observaciones']);
  const notas = extras.join(' | ') || null;

  sql += `INSERT INTO activos (serie, tipo_dispositivo, marca, modelo, estado, rut_responsable, ubicacion, observaciones) VALUES (${esc(serie)}, 'Laptop', ${esc(row['Marca'] || 'Genérica')}, ${esc(row['Modelo'] || 'Desconocido')}, ${esc(estado)}, ${esc(rut)}, ${esc((row['Ubicación'] || '').trim())}, ${esc(notas)}) ON CONFLICT (serie) DO UPDATE SET marca = EXCLUDED.marca, modelo = EXCLUDED.modelo, estado = EXCLUDED.estado, rut_responsable = EXCLUDED.rut_responsable, ubicacion = EXCLUDED.ubicacion, observaciones = EXCLUDED.observaciones;\n`;
}

const outPath = path.join(__dirname, '../import-actual.sql');
fs.writeFileSync(outPath, sql);
console.log(`✅ ${outPath}`);
console.log(`   Colaboradores: ${colabMap.size}`);
console.log(`   Activos: ${rows.length - omitidos} (omitidos sin serie: ${omitidos})`);
