const prisma = require('../lib/prisma');

async function parseMetaDuration(description) {
  if (!description) return null;
  try {
    const m = String(description).match(/\[META\]([\s\S]*?)\[META\]/);
    if (m && m[1]) {
      const parsed = JSON.parse(m[1]);
      if (parsed && parsed.durationMinutes) return Number(parsed.durationMinutes);
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function ensureColumn() {
  try {
    console.log('Adding column end_date if not exists...');
    // SQLite supports ADD COLUMN; if column exists this will fail - catch and continue
    await prisma.$executeRawUnsafe("ALTER TABLE events ADD COLUMN end_date DATETIME;");
    console.log('Column end_date added.');
  } catch (e) {
    console.log('Could not add column (it may already exist):', e.message || e);
  }
}

async function backfill() {
  await ensureColumn();
  console.log('Fetching events...');
  const events = await prisma.event.findMany();
  let updated = 0;
  for (const ev of events) {
    try {
      if (ev.end_date) continue; // already present
      // attempt to compute from description meta
      const durationFromMeta = await parseMetaDuration(ev.description);
      let duration = null;
      if (durationFromMeta) duration = durationFromMeta;
      // fallback: if event has a durationMinutes field (unlikely), use it
      if (!duration && ev.durationMinutes) duration = Number(ev.durationMinutes);

      if (!duration) {
        // no duration available, skip
        continue;
      }

      // need event.date (Date) and event.time (HH:MM)
      if (!ev.date || !ev.time) continue;
      const [hh, mm] = String(ev.time || '00:00').split(':').map(Number);
      const start = new Date(ev.date.getFullYear(), ev.date.getMonth(), ev.date.getDate(), hh || 0, mm || 0);
      const endDate = new Date(start.getTime() + Number(duration) * 60000);
      // use raw SQL update to avoid relying on generated client types
      try {
        await prisma.$executeRaw`UPDATE events SET end_date = ${endDate.toISOString()} WHERE id = ${ev.id}`;
        updated++;
      } catch (e) {
        console.warn('Raw update failed for', ev.id, e && e.message ? e.message : e);
      }
    } catch (e) {
      console.warn('Failed to backfill event', ev.id, e && e.message ? e.message : e);
    }
  }
  console.log('Backfill complete. Updated rows:', updated);
}

backfill()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
