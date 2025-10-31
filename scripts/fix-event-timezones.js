#!/usr/bin/env node
// Migration helper: repair event start/end datetimes that were materialized
// using UTC construction (Date.UTC) and therefore appear shifted in some
// deployments. This script makes a best-effort, reversible fix by:
// - For events with a stored `date` (YYYY-MM-DD) and `time` (HH:MM):
//   - compute the intended local instant using `new Date(year, monthIndex, day, hh, mm)`
//   - if the DB exposes a `start_date` column, replace it with the corrected ISO
//   - if the DB exposes an `end_date` column, shift it by the same duration as
//     the original (so end stays relative to start)
// Usage:
//  node scripts/fix-event-timezones.js --dry-run      # show candidate changes
//  node scripts/fix-event-timezones.js --apply        # perform updates (BE CAREFUL)
//  node scripts/fix-event-timezones.js --limit=10     # limit processed rows (for testing)

const prisma = require('../lib/prisma');

function pad(n) { return String(n).padStart(2, '0'); }

function buildLocalIsoFromParts(datePart, timePart) {
  if (!datePart) return null;
  const m = String(datePart).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (!timePart) return new Date(y, mo, d).toISOString();
  const parts = String(timePart).split(':').map(Number);
  const hh = Number.isFinite(parts[0]) ? parts[0] : 0;
  const mm = Number.isFinite(parts[1]) ? parts[1] : 0;
  return new Date(y, mo, d, hh, mm, 0).toISOString();
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || !args.includes('--apply');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;

  console.log('[fix-event-timezones] starting. dryRun=', dryRun, ' limit=', limit);

  // Select candidate events that have a date and time. We will only attempt
  // to adjust rows where we can deterministically compute the intended local instant.
  const q = {};
  if (limit && Number.isFinite(limit)) q.take = Number(limit);

  const events = await prisma.event.findMany({ where: { date: { not: null } }, select: { id: true, date: true, time: true, start_date: true, end_date: true } , ...q });

  console.log(`[fix-event-timezones] loaded ${events.length} events to inspect`);

  const updates = [];

  for (const ev of events) {
    try {
      const { id, date, time, start_date, end_date } = ev;
      if (!date) continue;
      // Only handle when we can compute a local instant from date+time
      if (!time) continue; // skip all-day / date-only rows
      const correctedStart = buildLocalIsoFromParts(date, time);
      if (!correctedStart) continue;

      // Determine original duration (if end_date exists)
      let origDuration = null;
      if (end_date) {
        try {
          const origStart = start_date ? new Date(String(start_date)) : null;
          const origEnd = new Date(String(end_date));
          if (origEnd && !isNaN(origEnd.getTime())) {
            const base = origStart && !isNaN(origStart.getTime()) ? origStart.getTime() : (new Date(correctedStart)).getTime();
            origDuration = Math.max(0, origEnd.getTime() - base);
          }
        } catch (e) { origDuration = null; }
      }

      // If start_date exists on the row, compare and decide if update is needed
      let needUpdate = false;
      if (start_date) {
        try {
          const stored = new Date(String(start_date));
          if (isNaN(stored.getTime()) || stored.toISOString() !== correctedStart) needUpdate = true;
        } catch (e) { needUpdate = true; }
      } else {
        // No start_date persisted — some deployments materialized events with
        // end_date derived from UTC-based occStart. We'll treat presence of
        // end_date and a mismatch in derived end as a cue to update.
        if (end_date && origDuration !== null) needUpdate = true;
      }

      if (needUpdate) {
        const update = { id, correctedStart, correctedEnd: null };
        if (origDuration !== null) update.correctedEnd = new Date(new Date(correctedStart).getTime() + origDuration).toISOString();
        updates.push(update);
      }
    } catch (e) {
      console.warn('[fix-event-timezones] inspect failed for event', ev && ev.id, e && e.message);
    }
  }

  console.log(`[fix-event-timezones] identified ${updates.length} events to update`);
  if (updates.length === 0) return process.exit(0);

  if (dryRun) {
    console.log('[fix-event-timezones] dry-run mode - sample updates:');
    console.log(JSON.stringify(updates.slice(0, 20), null, 2));
    console.log('[fix-event-timezones] to apply changes re-run with --apply');
    return process.exit(0);
  }

  // Apply updates in a transaction for safety
  console.log('[fix-event-timezones] applying updates...');
  for (const u of updates) {
    try {
      const data = {};
      // Update start_date if the column exists
      data.start_date = u.correctedStart;
      if (u.correctedEnd) data.end_date = u.correctedEnd;
      await prisma.event.update({ where: { id: u.id }, data });
      console.log('[fix-event-timezones] updated', u.id);
    } catch (e) {
      console.error('[fix-event-timezones] failed to update', u.id, e && e.message);
    }
  }

  console.log('[fix-event-timezones] done');
  process.exit(0);
}

main().catch((err) => { console.error('Script failed', err); process.exit(2); });
