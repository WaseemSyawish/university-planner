// backfill_end_dates.js
// Scans events where end_date is null and attempts to compute an end_date from
// - meta.endDate
// - meta.durationMinutes
// - embedded __META__ in description (JSON)
// Usage: node scripts/backfill_end_dates.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseMetaFromDescription(desc) {
  if (!desc || typeof desc !== 'string') return null;
  const idxAlt = desc.indexOf('\n\n__META__:');
  const idx = idxAlt !== -1 ? idxAlt : desc.indexOf('__META__:');
  if (idx === -1) return null;
  const jsonPart = desc.slice(idx + (idxAlt !== -1 ? 10 : 9)).trim();
  try { return JSON.parse(jsonPart); } catch (e) { return null; }
}

function parseDateOnlyToLocal(date) {
  if (!date) return null;
  const d = new Date(String(date));
  if (!isNaN(d.getTime())) return d;
  return null;
}

(async function main(){
  try {
    const candidates = await prisma.event.findMany({ where: { end_date: null }, take: 1000 });
    console.log('Found', candidates.length, 'events with null end_date (limiting to 1000)');
    let updated = 0;
    for (const ev of candidates) {
      let meta = ev.meta || null;
      if (!meta && ev.description) meta = parseMetaFromDescription(ev.description) || null;
      let endDate = null;
      if (meta && meta.endDate) {
        const parsed = new Date(String(meta.endDate));
        if (!isNaN(parsed.getTime())) endDate = parsed;
      }
      // If no explicit endDate, use durationMinutes
      if (!endDate && meta && typeof meta.durationMinutes !== 'undefined' && meta.durationMinutes !== null) {
        try {
          // Build a start Date from ev.date + ev.time (if available)
          let start = null;
          if (ev.date) start = new Date(String(ev.date));
          if (start && ev.time) {
            const parts = String(ev.time).split(':');
            const hh = Number(parts[0] || 0);
            const mm = Number(parts[1] || 0);
            if (Number.isFinite(hh) && Number.isFinite(mm)) start.setHours(hh, mm, 0, 0);
          }
          if (!start) start = new Date();
          endDate = new Date(start.getTime() + Number(meta.durationMinutes) * 60000);
        } catch (e) { /* ignore */ }
      }
      if (!endDate && ev.description) {
        // try to find an embedded __META__ with endDate/duration
        const embedded = parseMetaFromDescription(ev.description);
        if (embedded && embedded.endDate) {
          const parsed = new Date(String(embedded.endDate));
          if (!isNaN(parsed.getTime())) endDate = parsed;
        } else if (embedded && typeof embedded.durationMinutes !== 'undefined' && embedded.durationMinutes !== null) {
          try {
            let start = ev.date ? new Date(String(ev.date)) : new Date();
            if (ev.time) {
              const parts = String(ev.time).split(':');
              const hh = Number(parts[0] || 0);
              const mm = Number(parts[1] || 0);
              if (Number.isFinite(hh) && Number.isFinite(mm)) start.setHours(hh, mm, 0, 0);
            }
            endDate = new Date(start.getTime() + Number(embedded.durationMinutes) * 60000);
          } catch (e) {}
        }
      }

      if (endDate) {
        try {
          await prisma.event.update({ where: { id: ev.id }, data: { end_date: endDate } });
          console.log('Updated', ev.id, '->', endDate.toISOString());
          updated += 1;
        } catch (e) {
          console.error('Failed to update', ev.id, e && e.message ? e.message : e);
        }
      }
    }
    console.log('Backfill complete. Updated', updated, 'rows.');
  } catch (e) {
    console.error('Backfill failed:', e && e.message ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
})();
