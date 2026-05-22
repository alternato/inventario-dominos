// descubrir-tablas.js
// Muestra todas las tablas disponibles en tu Supabase
// USO: node descubrir-tablas.js

require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function httpGet(urlStr, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject).end();
  });
}

async function main() {
  console.log('\n🔍 Descubriendo tablas en Supabase...\n');

  // 1. Obtener schema OpenAPI (lista todas las tablas)
  const { status, body } = await httpGet(
    `${SUPABASE_URL}/rest/v1/`,
    {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  );

  if (status !== 200) {
    console.log(`❌ Error HTTP ${status}: ${body.slice(0, 300)}`);
    return;
  }

  const schema = JSON.parse(body);
  const tablas = Object.keys(schema.definitions || schema.paths || {});

  if (tablas.length === 0) {
    // Intentar con paths
    const paths = Object.keys(schema.paths || {})
      .map(p => p.replace('/', ''))
      .filter(p => p);
    console.log('📋 Rutas encontradas:', paths.join(', ') || 'ninguna');
  } else {
    console.log('📋 Tablas/definiciones encontradas:');
    tablas.forEach(t => console.log(`   - ${t}`));
  }

  // 2. Intentar acceder directamente a algunas tablas comunes
  const candidatos = ['usuarios', 'users', 'colaboradores', 'employees', 'activos', 'assets', 'devices', 'equipos', 'user_roles'];
  console.log('\n🧪 Probando acceso a tablas candidatas:');

  for (const tabla of candidatos) {
    const r = await httpGet(
      `${SUPABASE_URL}/rest/v1/${tabla}?select=id&limit=1`,
      {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Accept': 'application/json',
      }
    );
    const estado = r.status === 200 ? `✅ EXISTE (${JSON.parse(r.body).length} fila visible)` : `❌ HTTP ${r.status}`;
    console.log(`   ${tabla.padEnd(20)} ${estado}`);
  }
}

main().catch(console.error);
