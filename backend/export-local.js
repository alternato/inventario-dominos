require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false,
});

const escape = (val) => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return val;
  if (val instanceof Date) return `'${val.toISOString()}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
};

async function main() {
  let sql = `-- BACKUP LOCAL ${new Date().toISOString()}\nSET session_replication_role = replica;\n\n`;

  for (const table of ['usuarios', 'colaboradores', 'activos', 'historial_activos']) {
    const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
    console.log(`${table}: ${rows.length} registros`);
    if (rows.length > 0) {
      const cols = Object.keys(rows[0]).join(', ');
      sql += `-- ${table} (${rows.length} registros)\n`;
      sql += rows.map(r =>
        `INSERT INTO ${table} (${cols}) VALUES (${Object.values(r).map(escape).join(', ')}) ON CONFLICT DO NOTHING;`
      ).join('\n');
      sql += '\n\n';
    }
  }

  sql += 'SET session_replication_role = DEFAULT;\n';
  fs.writeFileSync('backup_inventario.sql', sql);
  console.log('✅ backup_inventario.sql generado');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
