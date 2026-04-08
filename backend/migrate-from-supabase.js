// =============================================================
// migrate-from-supabase.js - v3
// Migra datos reales según tablas descubiertas:
//   - activos, colaboradores, historial_activos
//   - usuarios desde Supabase Auth Admin API
//
// USO: cd backend && node migrate-from-supabase.js
// =============================================================

require('dotenv').config();
const https = require('https');
const { Pool } = require('pg');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const SUPABASE_URL  = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_KEY  = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_KEY.includes('...')) {
  console.error('\n❌ Faltan SUPABASE_URL o SUPABASE_KEY en .env\n');
  process.exit(1);
}

// -------------------------------------------------------
// DESTINO: PostgreSQL local
// -------------------------------------------------------
const destino = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'inventario_db',
  user:     process.env.DB_USER     || 'inventario_user',
  password: process.env.DB_PASSWORD || '',
  ssl: false,
  connectionTimeoutMillis: 10000,
});

// -------------------------------------------------------
// HELPERS HTTP
// -------------------------------------------------------
function httpGet(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...headers },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

const restHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Accept': 'application/json',
};

const authHeaders = {
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Accept': 'application/json',
};

async function fetchTabla(tabla, extra = '') {
  const r = await httpGet(
    `${SUPABASE_URL}/rest/v1/${tabla}?select=*&limit=10000${extra}`,
    restHeaders
  );
  if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${r.body.slice(0, 200)}`);
  return JSON.parse(r.body);
}

// -------------------------------------------------------
// HELPERS LOG
// -------------------------------------------------------
const ok  = (msg) => console.log(`  ✅ ${msg}`);
const err = (msg) => console.error(`  ❌ ${msg}`);
const log = (msg) => console.log(`  ${msg}`);

// -------------------------------------------------------
// MIGRACIÓN PRINCIPAL
// -------------------------------------------------------
async function migrate() {
  console.log('');
  console.log('🚀 Migrando Supabase → PostgreSQL local');
  console.log('='.repeat(50));

  // Verificar conexiones
  console.log('\n📡 Verificando conexiones...');

  const testActivos = await httpGet(`${SUPABASE_URL}/rest/v1/activos?select=*&limit=1`, restHeaders);
  if (testActivos.status !== 200) { err(`Supabase: HTTP ${testActivos.status}`); process.exit(1); }
  ok('Supabase accesible');

  await destino.query('SELECT 1')
    .then(() => ok('PostgreSQL local conectado'))
    .catch(e => { err(`PostgreSQL: ${e.message}`); process.exit(1); });

  // Aplicar schema
  console.log('\n📋 Aplicando schema...');
  await destino.query(fs.readFileSync('./schema.sql', 'utf8'));
  ok('Schema aplicado');

  // Migrar en orden
  await migrarUsuariosAuth();
  await migrarColaboradores();
  await migrarActivos();
  await migrarHistorial();

  console.log('\n' + '='.repeat(50));
  console.log('🎉 ¡Migración completada!');
  console.log('');
  console.log('   Usuarios migrados con contraseña temporal: Dominos@2024');
  console.log('   → Cámbialas desde la página de usuarios.');
  console.log('');
  console.log('   Próximo paso: npm run dev');
  console.log('');

  await destino.end();
}

// -------------------------------------------------------
// USUARIOS (desde Supabase Auth Admin API)
// -------------------------------------------------------
async function migrarUsuariosAuth() {
  console.log('\n👤 Migrando usuarios (Supabase Auth)...');

  let usuarios = [];
  try {
    const r = await httpGet(
      `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
      authHeaders
    );
    if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${r.body.slice(0, 300)}`);
    const parsed = JSON.parse(r.body);
    usuarios = parsed.users || parsed || [];
    log(`Encontrados: ${usuarios.length} usuario(s)`);
  } catch (e) {
    err(`Al leer usuarios Auth: ${e.message}`);
    log('Creando usuario admin por defecto...');
    usuarios = [];
  }

  // Contraseña temporal para todos los usuarios migrados
  const passwordTemporal = await bcrypt.hash('Dominos@2024', 10);
  let migrados = 0;

  for (const u of usuarios) {
    const email   = u.email;
    const nombre  = u.user_metadata?.nombre || u.user_metadata?.full_name || email?.split('@')[0] || 'Usuario';
    const rol     = u.user_metadata?.rol || u.app_metadata?.rol || 'viewer';

    if (!email) continue;

    try {
      await destino.query(
        `INSERT INTO usuarios (email, nombre, password, rol, activo, created_at, updated_at)
         VALUES ($1,$2,$3,$4,true,$5,$6)
         ON CONFLICT (email) DO NOTHING`,
        [email, nombre, passwordTemporal, rol,
         u.created_at || new Date(), u.updated_at || new Date()]
      );
      migrados++;
    } catch (e) {
      log(`⚠️  ${email}: ${e.message.split('\n')[0]}`);
    }
  }

  // Siempre asegurar que exista al menos 1 admin
  const { rows } = await destino.query(`SELECT COUNT(*) FROM usuarios WHERE rol = 'admin'`);
  if (parseInt(rows[0].count) === 0) {
    log('Creando usuario admin por defecto...');
    await destino.query(
      `INSERT INTO usuarios (email, nombre, password, rol, activo)
       VALUES ('admin@dominospizza.cl', 'Administrador TI', $1, 'admin', true)
       ON CONFLICT (email) DO NOTHING`,
      [passwordTemporal]
    );
    log('  Admin: admin@dominospizza.cl / Dominos@2024');
    migrados++;
  }

  ok(`Usuarios: ${migrados} procesados`);
}

// -------------------------------------------------------
// COLABORADORES
// -------------------------------------------------------
async function migrarColaboradores() {
  console.log('\n👥 Migrando colaboradores...');

  let filas;
  try {
    filas = await fetchTabla('colaboradores', '&order=id.asc');
    log(`Encontrados: ${filas.length} colaborador(es)`);
  } catch (e) {
    // Intentar sin order si da error
    try {
      filas = await fetchTabla('colaboradores');
      log(`Encontrados: ${filas.length} colaborador(es)`);
    } catch (e2) {
      err(`No se pudo leer colaboradores: ${e2.message}`);
      return;
    }
  }

  if (filas.length === 0) { log('Sin datos'); return; }

  const areasValidas = ['Operaciones', 'Administración', 'Logística', 'TI', 'RRHH', 'Otro'];
  let migrados = 0, omitidos = 0;

  for (const c of filas) {
    try {
      const area = areasValidas.includes(c.area) ? c.area : 'Otro';
      await destino.query(
        `INSERT INTO colaboradores (rut, nombre, correo, area, cargo, telefono, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (rut) DO UPDATE SET
           nombre = EXCLUDED.nombre, correo = EXCLUDED.correo,
           area = EXCLUDED.area, cargo = EXCLUDED.cargo,
           telefono = EXCLUDED.telefono, updated_at = EXCLUDED.updated_at`,
        [c.rut, c.nombre, c.correo ?? null, area,
         c.cargo ?? null, c.telefono ?? null,
         c.created_at ?? new Date(), c.updated_at ?? new Date()]
      );
      migrados++;
    } catch (e) {
      log(`⚠️  ${c.rut}: ${e.message.split('\n')[0]}`);
      omitidos++;
    }
  }

  ok(`Colaboradores: ${migrados} migrados, ${omitidos} omitidos`);
}

// -------------------------------------------------------
// ACTIVOS
// -------------------------------------------------------
async function migrarActivos() {
  console.log('\n📦 Migrando activos...');

  let filas;
  try {
    filas = await fetchTabla('activos', '&order=id.asc');
    log(`Encontrados: ${filas.length} activo(s)`);
  } catch (e) {
    err(`No se pudo leer activos: ${e.message}`);
    return;
  }

  if (filas.length === 0) { log('Sin datos'); return; }

  const tiposValidos = ['Laptop', 'Desktop', 'Smartphone', 'Tablet', 'SIM Card', 'Impresora', 'Otro'];
  const estadosValidos = ['Asignado', 'Disponible', 'Mantenimiento', 'Descartado'];
  let migrados = 0, omitidos = 0;

  for (const a of filas) {
    try {
      const tipo   = tiposValidos.includes(a.tipo_dispositivo)  ? a.tipo_dispositivo  : 'Otro';
      const estado = estadosValidos.includes(a.estado)           ? a.estado            : 'Disponible';

      await destino.query(
        `INSERT INTO activos
           (serie, marca, modelo, estado, tipo_dispositivo, rut_responsable,
            ubicacion, observaciones, fecha_compra, valor, numero_factura,
            imei, numero_sim, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (serie) DO UPDATE SET
           marca = EXCLUDED.marca, modelo = EXCLUDED.modelo,
           estado = EXCLUDED.estado, tipo_dispositivo = EXCLUDED.tipo_dispositivo,
           rut_responsable = EXCLUDED.rut_responsable,
           ubicacion = EXCLUDED.ubicacion, updated_at = EXCLUDED.updated_at`,
        [
          a.serie, a.marca, a.modelo, estado, tipo,
          a.rut_responsable ?? null, a.ubicacion ?? null,
          a.observaciones ?? null, a.fecha_compra ?? null,
          a.valor ?? null, a.numero_factura ?? null,
          a.imei ?? null, a.numero_sim ?? null,
          a.created_at ?? new Date(), a.updated_at ?? new Date()
        ]
      );
      migrados++;
    } catch (e) {
      log(`⚠️  ${a.serie}: ${e.message.split('\n')[0]}`);
      omitidos++;
    }
  }

  ok(`Activos: ${migrados} migrados, ${omitidos} omitidos`);
}

// -------------------------------------------------------
// HISTORIAL (ya existía en Supabase)
// -------------------------------------------------------
async function migrarHistorial() {
  console.log('\n📋 Migrando historial_activos...');

  let filas;
  try {
    filas = await fetchTabla('historial_activos', '&order=id.asc');
    log(`Encontrados: ${filas.length} registro(s)`);
  } catch (e) {
    log(`Sin historial o no accesible: ${e.message.split('\n')[0]}`);
    return;
  }

  if (filas.length === 0) { log('Sin datos'); return; }

  const tiposValidos = ['asignacion', 'devolucion', 'cambio_estado', 'creacion', 'baja', 'reparacion'];
  let migrados = 0, omitidos = 0;

  for (const h of filas) {
    try {
      const tipo = tiposValidos.includes(h.tipo_movimiento) ? h.tipo_movimiento : 'cambio_estado';
      await destino.query(
        `INSERT INTO historial_activos
           (serie, rut_anterior, rut_nuevo, estado_anterior, estado_nuevo,
            tipo_movimiento, notas, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT DO NOTHING`,
        [h.serie, h.rut_anterior ?? null, h.rut_nuevo ?? null,
         h.estado_anterior ?? null, h.estado_nuevo ?? null,
         tipo, h.notas ?? null, h.created_at ?? new Date()]
      );
      migrados++;
    } catch (e) {
      omitidos++;
    }
  }

  ok(`Historial: ${migrados} migrados, ${omitidos} omitidos`);
}

// -------------------------------------------------------
// EJECUTAR
// -------------------------------------------------------
migrate().catch(e => {
  console.error('\n💥 Error:', e.message);
  process.exit(1);
});
