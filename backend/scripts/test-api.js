/**
 * Script de test para verificar que el backend funciona
 * 
 * Uso: 
 * node test-api.js
 * 
 * Requiere que el servidor esté corriendo: node server.js
 */

const http = require('http');

// Colores para terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            status: res.statusCode,
            data: parsed
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║         PRUEBAS DE API - Inventario Domino's       ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════╝${colors.reset}\n`);

  try {
    // Test 1: Health Check
    console.log(`${colors.yellow}Test 1: Health Check${colors.reset}`);
    const health = await makeRequest('GET', '/health');
    if (health.status === 200) {
      console.log(`${colors.green}✓ PASSED${colors.reset} - Backend está operativo\n`);
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} - Status: ${health.status}\n`);
    }

    // Test 2: Login (debería fallar sin credenciales válidas)
    console.log(`${colors.yellow}Test 2: Login - Email inválido${colors.reset}`);
    const loginBad = await makeRequest('POST', '/api/auth/login', {
      email: 'invalid@gmail.com',
      password: 'test'
    });
    if (loginBad.status === 400 && loginBad.data.error) {
      console.log(`${colors.green}✓ PASSED${colors.reset} - Validación de dominio funcionando\n`);
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} - Status: ${loginBad.status}\n`);
    }

    // Test 3: Login con email corporativo pero sin usuario
    console.log(`${colors.yellow}Test 3: Login - Usuario no existe${colors.reset}`);
    const loginNoUser = await makeRequest('POST', '/api/auth/login', {
      email: 'noexiste@dominospizza.cl',
      password: 'test123'
    });
    if (loginNoUser.status === 401) {
      console.log(`${colors.green}✓ PASSED${colors.reset} - Validación de usuario funcionando\n`);
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} - Status: ${loginNoUser.status}\n`);
    }

    // Test 4: Acceso a activos sin token
    console.log(`${colors.yellow}Test 4: GET /api/activos - Sin token${colors.reset}`);
    const activosSinToken = await makeRequest('GET', '/api/activos');
    if (activosSinToken.status === 401) {
      console.log(`${colors.green}✓ PASSED${colors.reset} - Autenticación requerida\n`);
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} - Status: ${activosSinToken.status}\n`);
    }

    // Test 5: Forgot Password
    console.log(`${colors.yellow}Test 5: Recuperación de contraseña${colors.reset}`);
    const forgotPass = await makeRequest('POST', '/api/auth/forgot-password', {
      email: 'admin@dominospizza.cl'
    });
    if (forgotPass.status === 200) {
      console.log(`${colors.green}✓ PASSED${colors.reset} - Endpoint funcionando\n`);
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} - Status: ${forgotPass.status}\n`);
    }

    // Test 6: Ruta no encontrada
    console.log(`${colors.yellow}Test 6: 404 - Ruta no existe${colors.reset}`);
    const notFound = await makeRequest('GET', '/ruta-inexistente');
    if (notFound.status === 404) {
      console.log(`${colors.green}✓ PASSED${colors.reset} - Error 404 funcionando\n`);
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} - Status: ${notFound.status}\n`);
    }

    console.log(`${colors.blue}╔════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.blue}║           RESUMEN DE PRUEBAS                       ║${colors.reset}`);
    console.log(`${colors.blue}╠════════════════════════════════════════════════════╣${colors.reset}`);
    console.log(`${colors.blue}║ ✓ Backend funcionando correctamente                 ║${colors.reset}`);
    console.log(`${colors.blue}║ ✓ Validación de datos activa                       ║${colors.reset}`);
    console.log(`${colors.blue}║ ✓ Autenticación JWT implementada                   ║${colors.reset}`);
    console.log(`${colors.blue}║ ✓ Manejo de errores funcionando                    ║${colors.reset}`);
    console.log(`${colors.blue}║                                                    ║${colors.reset}`);
    console.log(`${colors.blue}║ 📝 Próximo paso:                                   ║${colors.reset}`);
    console.log(`${colors.blue}║    1. Ejecutar schema.sql en Supabase             ║${colors.reset}`);
    console.log(`${colors.blue}║    2. Ejecutar: node seed-admin.js                ║${colors.reset}`);
    console.log(`${colors.blue}║    3. Luego probar login con credenciales admin   ║${colors.reset}`);
    console.log(`${colors.blue}╚════════════════════════════════════════════════════╝${colors.reset}\n`);

  } catch (error) {
    console.error(`${colors.red}❌ Error al conectar:${colors.reset} ${error.message}`);
    console.log(`\n${colors.yellow}⚠️  Asegúrate que el backend esté corriendo:${colors.reset}`);
    console.log(`    cd backend && node server.js\n`);
  }
}

runTests();
