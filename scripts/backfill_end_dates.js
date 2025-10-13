// backfill_end_dates.js
// Safer backfill: dry-run by default; pass --apply to perform updates.
// Usage:
//   node scripts/backfill_end_dates.js --limit=200 --dry
//   node scripts/backfill_end_dates.js --limit=200 --apply

const prisma = require('../lib/prisma');

function parseMetaFromDescription(desc) {
  if (!desc || typeof desc !== 'string') return null;
  const idxAlt = desc.indexOf('\n\n__META__:');
  const idx = idxAlt !== -1 ? idxAlt : desc.indexOf('__META__:');
  if (idx === -1) return null;
  const jsonPart = desc.slice(idx + (idxAlt !== -1 ? 10 : 9)).trim();
  try { return JSON.parse(jsonPart); } catch (e) { return null; }
}

function coerceDateObj(d) {
  if (!d) return null;
  if (Object.prototype.toString.call(d) === '[object Date]') return d;
  const s = String(d);
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

(async function main(){
  try {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const limitArg = args.find(a => a.startsWith('--limit='));
    const limit = limitArg ? Math.min(2000, Math.max(1, Number(limitArg.split('=')[1] || 200))) : 200;

    console.log('Backfill started. apply=', apply, 'limit=', limit);

    const candidates = await prisma.event.findMany({ where: {}, take: limit, orderBy: { created_at: 'desc' }, select: { id: true, date: true, time: true, meta: true, description: true, end_date: true } });
    console.log('Scanning', candidates.length, 'events');
    const fixes = [];

    for (const ev of candidates) {
      try {
        let meta = ev.meta || null;
        if (!meta && ev.description) meta = parseMetaFromDescription(ev.description) || null;
        const dateObj = coerceDateObj(ev.date);
        if (!dateObj) continue;
        const dateY = dateObj.getFullYear();
        const dateM = dateObj.getMonth();
        const dateD = dateObj.getDate();
        const timeParts = String(ev.time || '09:00').split(':');
        const hh = Number(timeParts[0] || 9);
        const mm = Number(timeParts[1] || 0);

        const duration = meta && Number.isFinite(Number(meta.durationMinutes)) ? Number(meta.durationMinutes) : null;
        if (duration === null) continue; // nothing reliable to recompute

        const expectedStart = new Date(Date.UTC(dateY, dateM, dateD, hh, mm, 0));
        const expectedEnd = new Date(expectedStart.getTime() + Number(duration) * 60000);
        const expectedIso = expectedEnd.toISOString();

        const existing = ev.end_date ? (ev.end_date instanceof Date ? ev.end_date.toISOString() : String(ev.end_date)) : null;
        if (existing !== expectedIso) {
          fixes.push({ id: ev.id, date: `${dateY}-${(dateM+1).toString().padStart(2,'0')}-${dateD.toString().padStart(2,'0')}`, time: ev.time || null, existing, expectedIso });
          if (apply) {
            try {
              const newMeta = meta ? { ...meta, endDate: expectedIso } : { durationMinutes: duration, endDate: expectedIso };
              await prisma.event.update({ where: { id: ev.id }, data: { end_date: expectedIso, meta: newMeta } });
              console.log('Applied:', ev.id, '->', expectedIso);
            } catch (e) {
              console.error('Failed to apply fix for', ev.id, e && e.message ? e.message : e);
            }
          }
        }
      } catch (e) {
        console.error('Failed processing row', ev.id, e && e.message ? e.message : e);
      }
    }

    console.log('Mismatches found:', fixes.length);
    if (fixes.length > 0) console.log(fixes.slice(0, 50));
    console.log('Done.');
  } catch (e) {
    console.error('Backfill failed:', e && e.message ? e.message : e);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
    process.exit(0);
  }
})();
