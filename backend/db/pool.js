const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'inventario_db',
  user:     process.env.DB_USER     || 'inventario_user',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
    console.error('   Verifica las variables DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD en .env');
  } else {
    console.log(`✅ Conectado a PostgreSQL en ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'inventario_db'}`);
    release();
  }
});

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
