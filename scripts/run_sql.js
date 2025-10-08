// scripts/run_sql.js
// Usage: node scripts/run_sql.js prisma/create_archived.sql

const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Please provide an SQL file path');
    process.exit(2);
  }

  const sql = fs.readFileSync(file, 'utf8');
  const connection = process.env.DATABASE_URL;
  if (!connection) {
    console.error('No DATABASE_URL found in .env');
    process.exit(2);
  }

  const client = new Client({ connectionString: connection, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to DB, executing SQL...');
    await client.query(sql);
    console.log('SQL executed successfully');
  } catch (err) {
    console.error('SQL execution error:', err.message || err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
