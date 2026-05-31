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
  const n = v.toString().toLowerCase();
  if (n.includes('asignado') && !n.includes('no')) return 'Asignado';
  if (n.includes('mantenimiento')) return 'Mantenimiento';
  if (n.includes('descartado') || n.includes('baja')) return 'Descartado';
  return 'Disponible';
};

const parseMarcaModelo = (equipo) => {
  const e = (equipo || '').trim();
  const marcas = ['Samsung', 'Motorola', 'Apple', 'Iphone', 'Huawei', 'Xiaomi', 'Nokia', 'LG', 'Sony', 'Lenovo', 'ASUS', 'HP', 'Dell', 'Acer'];
  for (const m of marcas) {
    if (e.toLowerCase().startsWith(m.toLowerCase())) {
      const modelo = e.slice(m.length).trim() || e;
      const marca = m === 'Iphone' ? 'Apple' : m;
      const modeloFinal = m === 'Iphone' ? 'iPhone ' + modelo.replace(/^iPhone?\s*/i, '') : modelo;
      return { marca, modelo: modeloFinal || e };
    }
  }
  const parts = e.split(/\s+/);
  return { marca: parts[0] || 'Genérica', modelo: parts.slice(1).join(' ') || e };
};

const wb = XLSX.readFile(path.join(__dirname, '../Inventario_TI_1.xlsx'));

// ── PC ─────────────────────────────────────────────────────────────────────
const pcRows = XLSX.utils.sheet_to_json(wb.Sheets['PC'], { header: 1, defval: '' }).slice(2);
const colabMap = new Map();
const activosPC = [];
const seriesVistas = new Set();

for (const r of pcRows) {
  const [rut, persona, , estado, area, ubicacion, marca, modelo, serie, docFirmado, mochila, cargador, , , obs] = r;
  const serieClean = (serie || '').toString().trim();
  if (!serieClean || serieClean === 'Pendiente' || serieClean === 'N/A') continue;
  if (seriesVistas.has(serieClean)) continue;
  seriesVistas.add(serieClean);

  const rutClean = (rut || '').toString().trim().toUpperCase() || null;
  if (rutClean && !colabMap.has(rutClean)) {
    colabMap.set(rutClean, {
      rut: rutClean,
      nombre: (persona || 'Sin nombre').toString().trim(),
      area: (area || 'Otro').toString().trim() || 'Otro',
    });
  }

  const extras = [];
  if (docFirmado && docFirmado.toString().toUpperCase() === 'SI') extras.push('Doc. firmado');
  if (mochila && mochila.toString().toUpperCase() === 'SI') extras.push('Mochila');
  if (cargador && cargador.toString().toUpperCase() === 'SI') extras.push('Cargador');
  if (obs) extras.push(obs.toString().trim());

  activosPC.push({ serie: serieClean, tipo: 'Laptop', marca: marca || 'Genérica', modelo: modelo || 'Desconocido', estado: mapEstado(estado), rut: rutClean, ubicacion: (ubicacion || '').trim(), obs: extras.join(' | ') || null });
}

// ── Telefonía ────────────────────────────────────────────────────────────
const telRows = XLSX.utils.sheet_to_json(wb.Sheets['Telefonía'], { header: 1, defval: '' }).slice(2);
const activosTel = [];
const imeisVistos = new Set();

for (const r of telRows) {
  const [usuario, telefono, compania, equipo, imei, obsRaw, area] = r;
  const imeiClean = (imei || '').toString().trim();
  if (!imeiClean) continue;
  if (imeisVistos.has(imeiClean)) continue;
  imeisVistos.add(imeiClean);

  const { marca, modelo } = parseMarcaModelo(equipo);
  const extrasArr = [];
  if (usuario) extrasArr.push(`Usuario: ${usuario}`);
  if (obsRaw) extrasArr.push(obsRaw.toString().trim());

  activosTel.push({
    serie: imeiClean,
    tipo: 'Smartphone',
    marca,
    modelo,
    estado: usuario ? 'Asignado' : 'Disponible',
    rut: null,
    ubicacion: null,
    obs: extrasArr.join(' | ') || null,
    telefono: (telefono || '').toString().trim() || null,
    compania: (compania || '').toString().trim() || null,
    imei: imeiClean,
  });
}

// ── Generar SQL ────────────────────────────────────────────────────────────
let sql = `-- IMPORT desde Inventario_TI_1.xlsx\n-- PC: ${activosPC.length} | Telefonía: ${activosTel.length} | Colaboradores: ${colabMap.size}\n\n`;

sql += `-- ── COLABORADORES ─────────────────────────────────────────────────────────\n`;
for (const c of colabMap.values()) {
  sql += `INSERT INTO colaboradores (rut, nombre, area, activo) VALUES (${esc(c.rut)}, ${esc(c.nombre)}, ${esc(c.area)}, TRUE) ON CONFLICT (rut) DO UPDATE SET nombre = EXCLUDED.nombre, area = EXCLUDED.area;\n`;
}

sql += `\n-- ── ACTIVOS PC ────────────────────────────────────────────────────────────\n`;
for (const a of activosPC) {
  sql += `INSERT INTO activos (serie, tipo_dispositivo, marca, modelo, estado, rut_responsable, ubicacion, observaciones) VALUES (${esc(a.serie)}, ${esc(a.tipo)}, ${esc(a.marca)}, ${esc(a.modelo)}, ${esc(a.estado)}, ${esc(a.rut)}, ${esc(a.ubicacion)}, ${esc(a.obs)}) ON CONFLICT (serie) DO UPDATE SET marca=EXCLUDED.marca, modelo=EXCLUDED.modelo, estado=EXCLUDED.estado, rut_responsable=EXCLUDED.rut_responsable, ubicacion=EXCLUDED.ubicacion, observaciones=EXCLUDED.observaciones;\n`;
}

sql += `\n-- ── ACTIVOS TELEFONÍA ─────────────────────────────────────────────────────\n`;
for (const a of activosTel) {
  sql += `INSERT INTO activos (serie, tipo_dispositivo, marca, modelo, estado, rut_responsable, ubicacion, observaciones, numero_telefono, compania, imei) VALUES (${esc(a.serie)}, ${esc(a.tipo)}, ${esc(a.marca)}, ${esc(a.modelo)}, ${esc(a.estado)}, NULL, NULL, ${esc(a.obs)}, ${esc(a.telefono)}, ${esc(a.compania)}, ${esc(a.imei)}) ON CONFLICT (serie) DO UPDATE SET marca=EXCLUDED.marca, modelo=EXCLUDED.modelo, estado=EXCLUDED.estado, observaciones=EXCLUDED.observaciones, numero_telefono=EXCLUDED.numero_telefono, compania=EXCLUDED.compania, imei=EXCLUDED.imei;\n`;
}

const outPath = path.join(__dirname, '../import-inventario-ti.sql');
fs.writeFileSync(outPath, sql);
console.log(`✅ ${outPath}`);
console.log(`   Colaboradores: ${colabMap.size}`);
console.log(`   Activos PC: ${activosPC.length}`);
console.log(`   Activos Telefonía: ${activosTel.length}`);
console.log(`   Total activos: ${activosPC.length + activosTel.length}`);
