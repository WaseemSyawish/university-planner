/*
Simple non-psql backup: dumps `events` and `archived_events` tables to JSON files.
Usage (PowerShell):
  $env:DATABASE_URL = 'postgresql://user:pass@host:port/dbname'
  node scripts/dump_events.js

This requires NODE and network access. Safe, non-destructive.
*/

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  const url = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!url) {
    console.error('Please set DATABASE_URL (or DIRECT_URL) environment variable before running this script.');
    process.exit(2);
  }

  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log('Connected to DB');

    const outDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');

    const tables = ['events', 'archived_events'];
    for (const t of tables) {
      try {
        const res = await client.query(`SELECT * FROM public.${t} ORDER BY created_at DESC`);
        const file = path.join(outDir, `${t}_backup_${ts}.json`);
        fs.writeFileSync(file, JSON.stringify(res.rows, null, 2), 'utf8');
        console.log(`Wrote ${res.rows.length} rows to ${file}`);
      } catch (e) {
        console.warn(`Failed to dump table ${t}:`, e.message || e);
      }
    }

    console.log('Backup finished. Files are in the backups/ folder.');
  } catch (err) {
    console.error('Backup failed:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

if (require.main === module) main();
