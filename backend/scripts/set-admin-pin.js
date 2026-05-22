// set-admin-pin.js — Asigna el PIN al usuario admin
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

console.log('🔧 Conectando a PostgreSQL...');
console.log(`   Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
console.log(`   BD:   ${process.env.DB_NAME || 'inventario_db'}`);
console.log(`   User: ${process.env.DB_USER || 'inventario_user'}`);

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'inventario_db',
  user:     process.env.DB_USER     || 'inventario_user',
  password: process.env.DB_PASSWORD || 'inventario_secret_2024',
  ssl: false,
  connectionTimeoutMillis: 5000,
});

async function setAdminPin() {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Conexión exitosa.\n');

    // Listar TODOS los usuarios para diagnóstico
    const { rows: todos } = await client.query(
      `SELECT id, email, nombre, rol, activo, 
       CASE WHEN pin IS NOT NULL THEN 'Sí' ELSE 'No' END AS tiene_pin
       FROM usuarios ORDER BY rol DESC, nombre ASC`
    );

    console.log(`📋 Usuarios en la BD (${todos.length} total):`);
    todos.forEach(u => {
      console.log(`   [${u.id}] ${u.nombre} | ${u.email} | rol: ${u.rol} | activo: ${u.activo} | PIN: ${u.tiene_pin}`);
    });

    const pin = '012016';
    const hashedPin = await bcrypt.hash(pin, 10);
    console.log(`\n🔑 Hasheando PIN "${pin}"...`);

    // Asignar a todos los admins activos
    const admins = todos.filter(u => u.rol === 'admin');
    if (admins.length === 0) {
      console.log('\n⚠️  No hay usuarios con rol "admin". Asignando a TODOS los usuarios...');
      for (const u of todos) {
        await client.query(
          `UPDATE usuarios SET pin = $1, updated_at = NOW() WHERE id = $2`,
          [hashedPin, u.id]
        );
        console.log(`   ✅ PIN asignado a ${u.nombre} (${u.email})`);
      }
    } else {
      for (const admin of admins) {
        await client.query(
          `UPDATE usuarios SET pin = $1, updated_at = NOW() WHERE id = $2`,
          [hashedPin, admin.id]
        );
        console.log(`\n   ✅ PIN asignado a: ${admin.nombre} (${admin.email})`);
      }
    }

    console.log(`\n🎉 Listo. Ingresa con PIN: ${pin} desde la tab "Acceso PIN" del login.`);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error('   Código:', err.code);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

setAdminPin();
