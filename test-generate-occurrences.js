// Quick unit tests for server-side computeOccurrences used for materializing repeats
const assert = require('assert');

function computeOccurrences(startDateStr, opt, maxCount = 40) {
  const start = new Date(startDateStr + 'T00:00:00');
  let year = start.getFullYear();
  let end = new Date(year, 0, 15);
  if (end <= start) end = new Date(year + 1, 0, 15);
  const out = [];
  let cursor = new Date(start);
  let count = 0;
  const pushIf = (d) => { if (d <= end && count < maxCount) { out.push(d.toISOString().split('T')[0]); count += 1; } };
  if (opt === 'every-2-3-4') {
    while (cursor <= end && count < maxCount) { pushIf(new Date(cursor)); cursor.setDate(cursor.getDate() + 14); }
  } else {
    while (cursor <= end && count < maxCount) { pushIf(new Date(cursor)); cursor.setDate(cursor.getDate() + 7); }
  }
  return out;
}

// Tests
(function run() {
  // Weekly starting Sep 1, 2025 should include Sep + Oct + Nov + Dec + Jan up to 2026-01-15
  const w = computeOccurrences('2025-09-01', 'every-week');
  console.log('weekly count', w.length);
  assert(w.length > 0, 'should generate at least one occurrence');
  // Biweekly
  const b = computeOccurrences('2025-09-01', 'every-2-3-4');
  console.log('biweekly count', b.length);
  assert(b.length > 0 && b.length <= w.length, 'biweekly should be <= weekly');

  // Edge: starting Jan 16 should roll to next year Jan 15
  const edge = computeOccurrences('2025-01-16', 'every-week');
  // Should end at 2026-01-15, so include dates beyond 2025
  console.log('edge count', edge.length);
  assert(edge.length > 0, 'edge should have occurrences');

  console.log('All tests passed');
})();
