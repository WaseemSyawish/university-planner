const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(),'data');
const overridesFile = path.join(dataDir,'holidays-iq-kurdistan.json');
const normFile = path.join(dataDir,'holidays-academic-2025-2026-normalized.json');
const backupFile = path.join(dataDir,'holidays-iq-kurdistan.json.post-simplify.bak');

function read(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')||'[]'); } catch(e){ console.error('read error',p,e); return []; }}
function write(p,o){ fs.writeFileSync(p, JSON.stringify(o,null,2),'utf8'); }

if(!fs.existsSync(overridesFile)) { console.error('overrides missing'); process.exit(1); }
const overrides = read(overridesFile);
const normalized = fs.existsSync(normFile) ? read(normFile) : [];

if(!fs.existsSync(backupFile)) fs.copyFileSync(overridesFile, backupFile);

// Build map: holiday keyword -> set of dates (YYYY-MM-DD) from normalized
const map = new Map();
for(const it of normalized){
  const text = ((it.localName||'')+' '+(it.name||'')+' '+(it.sourceText||'')).toLowerCase();
  // only consider known holiday keywords
  const keywords = ['christmas','assyria','assyrian','eid','newroz','nawroz','birthday of prophet','mawlid','independence','labour','new year','easter','yazidi'];
  for(const kw of keywords){
    if(text.includes(kw)){
      const year = Number((it.date||'').slice(0,4));
      if(!map.has(kw)) map.set(kw, new Map());
      const yearMap = map.get(kw);
      if(!yearMap.has(year)) yearMap.set(year, new Set());
      yearMap.get(year).add(it.date);
    }
  }
}

function canonicalFor(name, year){
  const low = (name||'').toLowerCase();
  if(low.includes('christmas')) return `${year}-12-25`;
  if(low.includes("new year's")|| low.includes('new year')) return `${year}-01-01`;
  if(low.includes('independence')) return `${year}-10-03`;
  if(low.includes('labour')) return `${year}-05-01`;
  if(low.includes('assyr')) return `${year}-04-01`;
  if(low.includes('easter')) {
    // compute Gregorian Easter
    const Y = year;
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
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  // default: null
  return null;
}

let changed = 0;
const targetYears = [2025,2026];

for(const o of overrides){
  const y = Number((o.date||'').slice(0,4));
  if(!targetYears.includes(y)) continue;
  const name = (o.localName||o.name||'').toLowerCase();
  // find matching keyword in map
  let kwFound = null;
  for(const [kw, ym] of map.entries()){
    if(name.includes(kw) || (o.sourceText||'').toLowerCase().includes(kw)) { kwFound = kw; break; }
  }
  if(kwFound){
    const yearMap = map.get(kwFound) || new Map();
    const datesForYear = (yearMap.get(y) ? Array.from(yearMap.get(y)) : []);
    if(datesForYear.length > 0){
      // if current date not one of the normalized dates, replace with normalized date (choose earliest)
      if(!datesForYear.includes(o.date)){
        const newDate = datesForYear[0];
        console.log('Adjusting', o.localName, 'from', o.date, 'to', newDate);
        o.date = newDate;
        changed++;
      }
    } else {
      // fallback to canonical
      const can = canonicalFor(o.localName || o.name || '');
      if(can && can.slice(0,4) === String(y) && o.date !== can){
        console.log('Canonical adjust', o.localName, 'from', o.date, 'to', can);
        o.date = can;
        changed++;
      }
    }
  } else {
    // not a known holiday keyword; leave as-is
  }
}

if(changed>0){
  write(overridesFile, overrides);
  console.log('Wrote adjusted overrides, changes:', changed);
} else console.log('No changes required');

process.exit(0);
