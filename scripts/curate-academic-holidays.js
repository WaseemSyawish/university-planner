const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(),'data');
const normFile = path.join(dataDir,'holidays-academic-2025-2026-normalized.json');
const curatedFile = path.join(dataDir,'holidays-academic-2025-2026-curated.json');
const overridesFile = path.join(dataDir,'holidays-iq-kurdistan.json');

function readJSON(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')||'[]'); }catch(e){return [];} }
function writeJSON(p,obj){ fs.writeFileSync(p, JSON.stringify(obj,null,2),'utf8'); }

const items = readJSON(normFile);
if(!items.length){ console.error('No normalized items found at', normFile); process.exit(1); }

// Keywords and classification rules
const KEYWORDS = [
  'eid','newroz','christmas','assyrian','independence','uprising','birthday of prophet','yazidi','yazidis','labour day','easter','baghdad liberation','republic day','july revolution','assyrian new year','prophet', 'eid al-fitr','eid al-adha','holiday','leave','block leave'
];

function classifyName(name){
  const n = (name||'').toLowerCase();
  if(/newroz|nawroz|nawroz/.test(n)) return { counties: ['Kurdistan Region'], global: false };
  if(/eid|eid al-fitr|eid al-adha/.test(n)) return { counties: [], global: true };
  if(/christmas|assyrian/.test(n)) return { counties: [], global: true };
  if(/independence|uprising|baghdad liberation|republic day|july revolution/.test(n)) return { counties: [], global: true };
  if(/birthday of prophet|prophet muhammad|mawlid/i.test(n)) return { counties: [], global: true };
  if(/yazidi|yazidis|yazidis new year/i.test(n)) return { counties: [], global: true };
  if(/labour day|1 may|may 1|1 may 2026/i.test(n)) return { counties: [], global: true };
  if(/leave|block leave|winter block|summer block/i.test(n)) return { counties: [], global: false };
  // fallback: treat as campus event (not global)
  return { counties: [], global: false };
}

function looksLikeHoliday(it){
  const name = (it.localName||it.name||it.sourceText||'').toLowerCase();
  for(const k of KEYWORDS){ if(name.includes(k)) return true; }
  // Accept clearly formatted single dates like 2025-12-25
  if(/^\d{4}-\d{2}-\d{2}$/.test(it.date)) return true;
  return false;
}

const candidates = items.filter(looksLikeHoliday).map(it=>{
  const name = (it.localName||it.name||'').replace(/\s+/g,' ').trim();
  const cls = classifyName(name);
  return {
    date: it.date,
    localName: name,
    name: name.replace(/\d{2}\s?[A-Za-z]{3,9}\s?\d{4}/g,'').trim() || name,
    countryCode: 'IQ',
    counties: cls.counties,
    fixed: false,
    global: !!cls.global,
    sourceText: it.sourceText || ''
  };
});

// dedupe by date+name
const seen = new Set();
const curated = [];
for(const c of candidates){
  const key = `${c.date}::${(c.name||'').toLowerCase().slice(0,80)}`;
  if(seen.has(key)) continue;
  seen.add(key);
  curated.push(c);
}

writeJSON(curatedFile, curated);
console.log('Wrote curated file:', curatedFile, 'entries:', curated.length);

// Merge into overrides file (dedupe)
const overrides = readJSON(overridesFile);
const merged = [];
const seen2 = new Set();
for(const o of overrides){
  const key = `${o.date}::${(o.localName||o.name||'').toLowerCase().slice(0,80)}`;
  seen2.add(key);
  merged.push(o);
}
let added = 0;
for(const c of curated){
  const key = `${c.date}::${(c.localName||c.name||'').toLowerCase().slice(0,80)}`;
  if(seen2.has(key)) continue;
  merged.push(c);
  seen2.add(key);
  added++;
}

if(added>0){
  writeJSON(overridesFile, merged);
  console.log('Merged curated holidays into', overridesFile, 'added:', added);
} else {
  console.log('No new curated entries to merge into', overridesFile);
}

process.exit(0);
