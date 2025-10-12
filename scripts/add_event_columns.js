/*
Safe DB helper to add `end_date` and `meta` columns to the `events` table
for PostgreSQL. This script runs ALTER TABLE ... ADD COLUMN IF NOT EXISTS
so it is safe to run multiple times and won't drop or modify existing data.

Usage (PowerShell):
  $env:DATABASE_URL = "postgresql://user:pass@host:5432/dbname?schema=public"
  node scripts/add_event_columns.js

The script uses node-postgres directly and requires `DATABASE_URL` to be set.
*/

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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

    // If a SQL file exists in prisma/sql, execute it atomically
    const sqlPath = path.join(__dirname, '..', 'prisma', 'sql', 'add-end-and-meta.sql');
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log('Executing SQL file:', sqlPath);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('Executed SQL file successfully.');
      return;
    }

    // Check if events table exists
    const tableCheck = await client.query(`
      SELECT to_regclass('public.events') as tbl, to_regclass('public.archived_events') as archived_tbl;
    `);
    if (!tableCheck.rows || !tableCheck.rows[0] || !tableCheck.rows[0].tbl) {
      console.error('Table `events` not found in public schema. Aborting.');
      process.exit(3);
    }

    // Add end_date column if not exists on events
    console.log('Adding column end_date (if not exists) to events');
    await client.query(`ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;`);

    // Add meta JSONB column if not exists on events
    console.log('Adding column meta (if not exists) to events');
    await client.query(`ALTER TABLE public.events ADD COLUMN IF NOT EXISTS meta JSONB;`);

    // For archived_events, check and add if table exists
    if (tableCheck.rows[0].archived_tbl) {
      console.log('Adding columns to archived_events (if not exists)');
      await client.query(`ALTER TABLE public.archived_events ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;`);
      await client.query(`ALTER TABLE public.archived_events ADD COLUMN IF NOT EXISTS meta JSONB;`);
    }

    // Ensure index on date column exists (optional)
    console.log('Ensuring index idx_events_date exists');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_date ON public.events (date);`);

    console.log('Columns added successfully (if they were missing).');
  } catch (err) {
    console.error('Failed to alter table:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

if (require.main === module) main();
