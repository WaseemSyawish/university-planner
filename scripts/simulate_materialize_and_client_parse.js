// Simulate server-side materialization and client-side parsing for a Mon+Thu 10:30-12:00 repeat
function isDateOnly(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value); }
function parseDateForStorage(value) {
  if (!value) return new Date();
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  const s = String(value);
  if (isDateOnly(s)) return new Date(s + 'T00:00:00');
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}
function localDateOnlyString(d) {
  const dt = (Object.prototype.toString.call(d) === '[object Date]') ? d : new Date(String(d));
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeOccurrences(startDate, byDays, intervalWeeks=1, maxCount=10) {
  const out = [];
  const start = new Date(startDate);
  const year = start.getFullYear();
  let end = new Date(year, 0, 15);
  if (end <= start) end = new Date(year+1, 0, 15);
  let cursor = new Date(start);
  let count = 0;
  const startTime = start.getTime();
  while (cursor <= end && count < maxCount) {
    const daysSinceStart = Math.floor((cursor.getTime() - startTime) / (1000*60*60*24));
    const weekIndex = Math.floor(daysSinceStart/7);
    if (byDays.includes(cursor.getDay()) && (weekIndex % intervalWeeks) === 0) {
      out.push(new Date(cursor));
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function simulate() {
  const startDateStr = '2025-09-01'; // Monday
  const dt = parseDateForStorage(startDateStr); // server uses parseDateForStorage
  const byDays = [1,4]; // Mon (1) and Thu (4)
  const occ = computeOccurrences(dt, byDays, 1, 10);
  console.log('Occurrences (dates) from server computeOccurrences:');
  console.log(occ.map(d => ({
    iso: d.toISOString(),
    local: d.toLocaleString(),
    ymd: localDateOnlyString(d),
    weekday: d.getDay()
  })));

  // Server materialize: for each d, do occStart = new Date(d); occStart.setHours(10,30)
  console.log('\nServer materialized occStart / occEnd (server-side JS logic):');
  const durationMinutes = 90; // 10:30 - 12:00
  const serverEvents = occ.map(d => {
    const occStart = new Date(d);
    occStart.setHours(10,30,0,0);
    const occEnd = new Date(occStart.getTime() + durationMinutes*60000);
    return {
      dateObj: d,
      occStartISO: occStart.toISOString(),
      occStartLocal: occStart.toLocaleString(),
      occEndISO: occEnd.toISOString(),
      occEndLocal: occEnd.toLocaleString(),
      dateYMD: localDateOnlyString(d)
    }
  });
  serverEvents.forEach(e => console.log(JSON.stringify(e)));

  // API returns events with date normalized (YYYY-MM-DD) and end_date as ISO (if present)
  // Simulate client receiving e.date = 'YYYY-MM-DD', e.time='10:30', e.endDate = server occEndISO
  console.log('\nClient parsing behavior (mapToSchedulerEvents):');
  serverEvents.forEach((ev, idx) => {
    const dateStr = ev.dateYMD; // '2025-09-01' etc
    const timeStr = '10:30';
    const [y,m,d] = dateStr.split('-').map(Number);
    const [hh,mm] = timeStr.split(':').map(Number);
    const clientStart = new Date(y, m-1, d, hh, mm, 0);
    const rawEnd = ev.occEndISO; // ISO string from server
    const clientEndFromRaw = new Date(String(rawEnd));
    const clientEndFromDuration = new Date(clientStart.getTime() + durationMinutes*60000);
    const clientEndFromRawISO = clientEndFromRaw.toISOString();
    const clientEndFromDurationISO = clientEndFromDuration.toISOString();
    console.log({
      dateStr,
      clientStartISO: clientStart.toISOString(),
      clientStartLocal: clientStart.toLocaleString(),
      clientEndFromRawISO,
      clientEndFromRawLocal: clientEndFromRaw.toLocaleString(),
      clientEndFromDurationISO,
      clientEndFromDurationLocal: clientEndFromDuration.toLocaleString(),
      note: clientEndFromRawISO === clientEndFromDurationISO ? 'matches' : 'mismatch'
    });
  });
}

simulate();
