const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
const eventsFile = path.join(dataDir, 'events.json');
const overridesFile = path.join(dataDir, 'holidays-iq-kurdistan.json');

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p,'utf8')||'[]'); } catch(e){ return []; } }

let eventsRaw = readJSON(eventsFile);
// normalize events: file may contain { events: [...] } or an array
const events = Array.isArray(eventsRaw) ? eventsRaw : (eventsRaw && Array.isArray(eventsRaw.events) ? eventsRaw.events : []);
const overrides = readJSON(overridesFile);
const eidLookupFile = path.join(process.cwd(),'data','holiday-eid-lookup.json');
const eidLookup = readJSON(eidLookupFile);

const target = process.argv[2] || '2025-03-21';

// Simple islamic->gregorian tabular functions (copied from API)
function islamicToJD(iy, im, id) {
  const n = id + Math.ceil(29.5 * (im - 1)) + (iy - 1) * 354 + Math.floor((3 + 11 * iy) / 30);
  return n + 1948439;
}
function jdToGregorian(jd) {
  let j = Math.floor(jd) + 0;
  let l = j + 68569;
  let n = Math.floor((4 * l) / 146097);
  l = l - Math.floor((146097 * n + 3) / 4);
  let i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  let j1 = Math.floor((80 * l) / 2447);
  let day = l - Math.floor((2447 * j1) / 80);
  l = Math.floor(j1 / 11);
  let month = j1 + 2 - 12 * l;
  let year = 100 * (n - 49) + i + l;
  return { year, month, day };
}

function computeEidsForYear(Y) {
  const computed = [];
  const approxHijri = Math.floor((Y - 622) * 33 / 32);
  const candidates = [approxHijri - 1, approxHijri, approxHijri + 1, approxHijri + 2];
  for (const hy of candidates) {
    if (hy <= 0) continue;
    const jdFitr = islamicToJD(hy, 10, 1);
    const gFitr = jdToGregorian(jdFitr);
    if (gFitr.year === Y) {
      const mm = String(gFitr.month).padStart(2, '0');
      const dd = String(gFitr.day).padStart(2, '0');
      computed.push({ date: `${gFitr.year}-${mm}-${dd}`, localName: 'Eid al-Fitr', name: 'Eid al-Fitr' });
    }
    const jdAdha = islamicToJD(hy, 12, 10);
    const gAdha = jdToGregorian(jdAdha);
    if (gAdha.year === Y) {
      const mm = String(gAdha.month).padStart(2, '0');
      const dd = String(gAdha.day).padStart(2, '0');
      computed.push({ date: `${gAdha.year}-${mm}-${dd}`, localName: 'Eid al-Adha', name: 'Eid al-Adha' });
    }
  }
  return computed;
}

// Compute recurring western/novel holidays
function computeGregorianEaster(Y) {
  const a = Y % 19;
  const b = Math.floor(Y / 100);
  const c = Y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const mm = String(month).padStart(2,'0');
  const dd = String(day).padStart(2,'0');
  return `${Y}-${mm}-${dd}`;
}

function recurringHolidaysForYear(Y) {
  const list = [];
  list.push({ date: computeGregorianEaster(Y), name: 'Easter' });
  list.push({ date: `${Y}-12-25`, name: 'Christmas Day' });
  list.push({ date: `${Y}-03-21`, name: 'Newroz' });
  list.push({ date: `${Y}-10-03`, name: 'Iraq Independence Day' });
  // Eid dates from lookup if present
  const lookup = eidLookup.find(x => Number(x.year) === Number(Y));
  if (lookup) {
    if (lookup.eidFitr) list.push({ date: lookup.eidFitr, name: 'Eid al-Fitr' });
    if (lookup.eidAdha) list.push({ date: lookup.eidAdha, name: 'Eid al-Adha' });
  }
  // Also compute tabular Eids as fallback
  const eidsComputed = computeEidsForYear(Y);
  for (const e of eidsComputed) {
    if (!list.find(x => x.date === e.date && x.name === e.localName)) list.push({ date: e.date, name: e.localName });
  }
  return list;
}

const [y] = target.split('-');
const recurring = recurringHolidaysForYear(Number(y));
const eids = computeEidsForYear(Number(y));

let holidayMatches = [];
// overrides from local Kurdish overrides
holidayMatches.push(...overrides.filter(h => h.date === target).map(h => ({ date: h.date, name: h.localName || h.name })));
// lookup/recurring/general holidays
holidayMatches.push(...recurring.filter(h => h.date === target).map(h => ({ date: h.date, name: h.name })));
// eid computed (if not already present)
holidayMatches.push(...eids.filter(e => e.date === target).map(e => ({ date: e.date, name: e.localName })));
// dedupe by date+name
const seen = new Set();
holidayMatches = holidayMatches.filter(h => {
  const key = `${h.date}::${(h.name||'').toLowerCase()}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
const eventMatches = events.filter(e => e.date && e.date.startsWith(target));

console.log('Date:', target);
console.log('Events found:', eventMatches.length);
console.log(eventMatches.map(e => ({ id: e.id, title: e.title || e.name || e.localName || '(no title)', type: e.type || 'event' })));
console.log('Holidays found:', holidayMatches.length);
console.log(holidayMatches.map(h => ({ date: h.date, name: h.localName || h.name })));
