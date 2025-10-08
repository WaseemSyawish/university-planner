// scripts/add-meta-columns.js
// Idempotently add `meta` column to events and archived_events for local SQLite DBs
require('dotenv').config();
const prisma = require('../lib/prisma');

(async () => {
  try {
    console.log('Checking events table columns...');
    const eventsCols = await prisma.$queryRawUnsafe("PRAGMA table_info('events')");
    const hasMeta = eventsCols && eventsCols.some && eventsCols.some(c => String(c.name).toLowerCase() === 'meta');
    if (hasMeta) {
      console.log('events.meta already exists, skipping');
    } else {
      console.log('Adding meta column to events...');
      try {
        await prisma.$executeRawUnsafe("ALTER TABLE events ADD COLUMN meta TEXT");
        console.log('Added events.meta');
      } catch (e) { console.error('Failed to add events.meta:', e && e.message ? e.message : e); }
    }

    console.log('Checking archived_events table columns...');
    const archCols = await prisma.$queryRawUnsafe("PRAGMA table_info('archived_events')");
    const hasMetaArch = archCols && archCols.some && archCols.some(c => String(c.name).toLowerCase() === 'meta');
    if (hasMetaArch) {
      console.log('archived_events.meta already exists, skipping');
    } else {
      console.log('Adding meta column to archived_events...');
      try {
        await prisma.$executeRawUnsafe("ALTER TABLE archived_events ADD COLUMN meta TEXT");
        console.log('Added archived_events.meta');
      } catch (e) { console.error('Failed to add archived_events.meta:', e && e.message ? e.message : e); }
    }

    console.log('Done.');
  } catch (err) {
    console.error('Script error:', err && err.message ? err.message : err);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
})();
