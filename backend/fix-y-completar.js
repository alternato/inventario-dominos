// fix-total.js - Solución completa
// USO: node fix-total.js

require('dotenv').config();
const https = require('https');
const { Pool } = require('pg');

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const db = new Pool({
  host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'inventario_db', user: process.env.DB_USER || 'inventario_user',
  password: process.env.DB_PASSWORD || '', ssl: false,
});

const ok  = (msg) => console.log(`  ✅ ${msg}`);
const log = (msg) => console.log(`  ${msg}`);
const err = (msg) => console.error(`  ❌ ${msg}`);

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { 'Content-Type': 'application/json', ...headers }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject).end();
  });
}

const H = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Accept': 'application/json' };

async function fetchTabla(tabla) {
  const r = await httpGet(`${SUPABASE_URL}/rest/v1/${tabla}?select=*&limit=10000`, H);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${r.body.slice(0,200)}`);
  return JSON.parse(r.body);
}

async function main() {
  console.log('\n🔧 Fix total — corrigiendo todos los problemas\n');

  // ─────────────────────────────────────────────────────
  // PASO 1: Drop views → Alter columns → Recrear views
  // ─────────────────────────────────────────────────────
  console.log('1️⃣  Arreglando tipos de columnas...');
  try {
    await db.query(`
      -- Borrar vistas que dependen de las columnas
      DROP VIEW IF EXISTS v_activos CASCADE;
      DROP VIEW IF EXISTS v_colaboradores_resumen CASCADE;
      DROP VIEW IF EXISTS activos_con_colaborador CASCADE;

      -- Ampliar columnas VARCHAR(12) → VARCHAR(50)
      ALTER TABLE colaboradores      ALTER COLUMN rut             TYPE VARCHAR(50);
      ALTER TABLE activos            ALTER COLUMN rut_responsable TYPE VARCHAR(50);
      ALTER TABLE historial_activos  ALTER COLUMN rut_anterior    TYPE VARCHAR(50);
      ALTER TABLE historial_activos  ALTER COLUMN rut_nuevo       TYPE VARCHAR(50);

      -- Recrear vistas
      CREATE OR REPLACE VIEW v_activos AS
        SELECT a.*, c.nombre AS colaborador_nombre, c.correo AS colaborador_correo,
               c.area AS colaborador_area, c.cargo AS colaborador_cargo
        FROM activos a LEFT JOIN colaboradores c ON a.rut_responsable = c.rut;

      CREATE OR REPLACE VIEW v_colaboradores_resumen AS
        SELECT c.*, COUNT(a.serie) FILTER (WHERE a.estado = 'Asignado') AS total_activos_asignados
        FROM colaboradores c LEFT JOIN activos a ON a.rut_responsable = c.rut
        GROUP BY c.id, c.rut;
    `);
    ok('Columnas ampliadas a VARCHAR(50), vistas recreadas');
  } catch (e) {
    err(`Error al alterar columnas: ${e.message.split('\n')[0]}`);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────
  // PASO 2: Colaboradores omitidos (RUTs largos)
  // ─────────────────────────────────────────────────────
  console.log('\n2️⃣  Completando colaboradores...');
  try {
    const filas = await fetchTabla('colaboradores');
    const areas = ['Operaciones', 'Administración', 'Logística', 'TI', 'RRHH', 'Otro'];
    let nuevos = 0;
    for (const c of filas) {
      try {
        const area = areas.includes(c.area) ? c.area : 'Otro';
        const r = await db.query(
          `INSERT INTO colaboradores (rut, nombre, correo, area, cargo, telefono, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (rut) DO NOTHING`,
          [c.rut, c.nombre, c.correo??null, area, c.cargo??null, c.telefono??null,
           c.created_at??new Date(), c.updated_at??new Date()]
        );
        if (r.rowCount > 0) nuevos++;
      } catch (e) { log(`⚠️  ${c.rut}: ${e.message.split('\n')[0]}`); }
    }
    ok(`Colaboradores: ${nuevos} nuevo(s) insertado(s)`);
  } catch (e) { err(e.message); }

  // ─────────────────────────────────────────────────────
  // PASO 3: Activos omitidos (rut_responsable largo)
  // ─────────────────────────────────────────────────────
  console.log('\n3️⃣  Completando activos...');
  try {
    const filas = await fetchTabla('activos');
    const tiposV   = ['Laptop','Desktop','Smartphone','Tablet','SIM Card','Impresora','Otro'];
    const estadosV = ['Asignado','Disponible','Mantenimiento','Descartado'];
    let nuevos = 0;
    for (const a of filas) {
      try {
        const tipo   = tiposV.includes(a.tipo_dispositivo)  ? a.tipo_dispositivo  : 'Otro';
        const estado = estadosV.includes(a.estado)           ? a.estado            : 'Disponible';

        // Si rut_responsable no existe como colaborador, poner null
        let rut = a.rut_responsable ?? null;
        if (rut) {
          const { rows } = await db.query('SELECT 1 FROM colaboradores WHERE rut=$1', [rut]);
          if (rows.length === 0) rut = null; // colaborador no migrado → null
        }

        const r = await db.query(
          `INSERT INTO activos
             (serie, marca, modelo, estado, tipo_dispositivo, rut_responsable,
              ubicacion, observaciones, fecha_compra, valor, numero_factura,
              imei, numero_sim, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (serie) DO NOTHING`,
          [a.serie, a.marca, a.modelo, estado, tipo, rut,
           a.ubicacion??null, a.observaciones??null, a.fecha_compra??null,
           a.valor??null, a.numero_factura??null,
           a.imei??null, a.numero_sim??null,
           a.created_at??new Date(), a.updated_at??new Date()]
        );
        if (r.rowCount > 0) nuevos++;
      } catch (e) { log(`⚠️  ${a.serie}: ${e.message.split('\n')[0]}`); }
    }
    ok(`Activos: ${nuevos} nuevo(s) insertado(s)`);
  } catch (e) { err(e.message); }

  // ─────────────────────────────────────────────────────
  // PASO 4: Historial — insertar sin FK check estricto
  // ─────────────────────────────────────────────────────
  console.log('\n4️⃣  Migrando historial...');
  try {
    const filas = await fetchTabla('historial_activos');
    const tiposV = ['asignacion','devolucion','cambio_estado','creacion','baja','reparacion'];

    // Obtener todas las series locales
    const { rows: seriesLocales } = await db.query('SELECT serie FROM activos');
    const seriesSet = new Set(seriesLocales.map(r => r.serie));

    // Limpiar historial existente
    await db.query('TRUNCATE historial_activos RESTART IDENTITY');

    let migrados = 0, sinSerie = 0;
    for (const h of filas) {
      // Si la serie no existe localmente, aun así intentamos insertar (sin FK constraint)
      // Si la FK falla, lo saltamos
      const tipo = tiposV.includes(h.tipo_movimiento) ? h.tipo_movimiento : 'cambio_estado';
      try {
        await db.query(
          `INSERT INTO historial_activos
             (serie, rut_anterior, rut_nuevo, estado_anterior, estado_nuevo, tipo_movimiento, notas, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [h.serie, h.rut_anterior??null, h.rut_nuevo??null,
           h.estado_anterior??null, h.estado_nuevo??null,
           tipo, h.notas??null, h.created_at??new Date()]
        );
        migrados++;
      } catch (e) {
        sinSerie++;
        // Serie no existe en activos locales — insertar sin FK (temporalmente)
      }
    }
    ok(`Historial: ${migrados} migrados, ${sinSerie} sin serie local`);

    // Si hubo historial sin serie, remover FK constraint de historial para que no bloquee
    if (sinSerie > 0 && migrados === 0) {
      log('Removiendo FK de historial para permitir registros huérfanos...');
      await db.query(`
        ALTER TABLE historial_activos DROP CONSTRAINT IF EXISTS historial_activos_serie_fkey;
      `);
      // Reintentar sin FK
      await db.query('TRUNCATE historial_activos RESTART IDENTITY');
      let m2 = 0;
      for (const h of filas) {
        const tipo = tiposV.includes(h.tipo_movimiento) ? h.tipo_movimiento : 'cambio_estado';
        try {
          await db.query(
            `INSERT INTO historial_activos
               (serie, rut_anterior, rut_nuevo, estado_anterior, estado_nuevo, tipo_movimiento, notas, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [h.serie, h.rut_anterior??null, h.rut_nuevo??null,
             h.estado_anterior??null, h.estado_nuevo??null,
             tipo, h.notas??null, h.created_at??new Date()]
          );
          m2++;
        } catch (e) { /* skip */ }
      }
      ok(`Historial (sin FK): ${m2} migrados`);
    }
  } catch (e) { err(e.message); }

  // ─────────────────────────────────────────────────────
  // RESUMEN FINAL
  // ─────────────────────────────────────────────────────
  console.log('\n📊 Estado final:');
  for (const t of ['usuarios','colaboradores','activos','historial_activos']) {
    const { rows } = await db.query(`SELECT COUNT(*) FROM ${t}`);
    log(`   ${t.padEnd(25)} ${rows[0].count} registros`);
  }

  console.log('\n✅ ¡Listo! Ejecuta: npm run dev\n');
  await db.end();
}

main().catch(e => { console.error('\n💥', e.message); process.exit(1); });
