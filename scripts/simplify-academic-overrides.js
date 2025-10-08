const fs = require('fs');
const path = require('path');

const DATA = path.join(process.cwd(),'data');
const OVERRIDES = path.join(DATA,'holidays-iq-kurdistan.json');
const BACKUP = path.join(DATA,'holidays-iq-kurdistan.json.bak');
const OUTSTRICT = path.join(DATA,'holidays-iq-kurdistan-strict-2025-2026.json');

function read(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')||'[]'); } catch(e){ console.error('Read error',e); return []; }}
function write(p,obj){ fs.writeFileSync(p, JSON.stringify(obj,null,2),'utf8'); }

if (!fs.existsSync(OVERRIDES)) { console.error('Overrides not found:', OVERRIDES); process.exit(1); }
// backup
if (!fs.existsSync(BACKUP)) fs.copyFileSync(OVERRIDES, BACKUP);

const items = read(OVERRIDES);
const holidayKeywords = [
  'eid','eid al-fitr','eid al-adha','newroz','nawroz','christmas','assyrian','independence','uprising','birthday of prophet','mawlid','yazidi','easter','labour day','labour','new year','assyrian new year','baghdad liberation','republic day','july revolution'
];
const firstKeywords = ['first day','first day of','first day of semester','first day of semester i','first day of semester ii','first day -'];
const lastKeywords = ['last day','last day of','last day of semester','final exams','end of semester','end of term','end of semester'];
const resumeKeywords = ['resume','restart','return','make up classes','compensation of holidays','makeup classes','return to classes','re-start','resume after'];

function containsAny(s, arr){ if(!s) return false; const low = s.toLowerCase(); return arr.some(k=>low.includes(k)); }

const targetYears = [2025,2026];
const kept = [];
const removed = [];

for(const it of items){
  const date = (it.date||'').slice(0,10);
  const year = Number(date.slice(0,4)) || null;
  if (!year || !targetYears.includes(year)) {
    kept.push(it); // keep other years untouched
    continue;
  }
  const text = ((it.localName||'') + ' ' + (it.name||'') + ' ' + (it.sourceText||'')).replace(/\s+/g,' ').trim();
  if (containsAny(text, holidayKeywords)) {
    // extract the primary holiday keyword to simplify name
    const low = text.toLowerCase();
    const found = holidayKeywords.find(k => low.includes(k));
    let nice = '';
    if (found) {
      // map some keywords to canonical names
      if (found.includes('eid al-fitr')) nice = 'Eid al-Fitr';
      else if (found.includes('eid al-adha')) nice = 'Eid al-Adha';
      else if (found.includes('eid')) nice = 'Eid';
      else if (found.includes('newroz')||found.includes('nawroz')) nice = 'Newroz';
      else if (found.includes('christmas')) nice = 'Christmas Day';
      else if (found.includes('assyrian')) nice = 'Assyrian New Year';
      else if (found.includes('independence')) nice = 'Independence Day';
      else if (found.includes('uprising')) nice = 'Uprising Day';
      else if (found.includes('birthday of prophet')||found.includes('mawlid')||found.includes('prophet')) nice = 'Birthday of Prophet Mohammed (PBUH)';
      else if (found.includes('yazidi')) nice = 'Yazidis New Year';
      else if (found.includes('easter')) nice = 'Easter';
      else if (found.includes('labour')) nice = 'International Labour Day';
      else if (found.includes('new year')) nice = 'New Year\'s Day';
      else nice = (it.localName||it.name||'Holiday').trim();
    }
    const out = Object.assign({}, it, { localName: nice, name: nice, global: true, counties: [] });
    kept.push(out);
    continue;
  }
  // keep first/last/resume entries
  if (containsAny(text, firstKeywords)) {
    const nice = 'First Day of Semester';
    const out = Object.assign({}, it, { localName: nice, name: nice, global: false });
    kept.push(out);
    continue;
  }
  if (containsAny(text, lastKeywords)) {
    const nice = 'Last Day of Semester';
    const out = Object.assign({}, it, { localName: nice, name: nice, global: false });
    kept.push(out);
    continue;
  }
  if (containsAny(text, resumeKeywords)) {
    const nice = 'Return to Classes (after holidays)';
    const out = Object.assign({}, it, { localName: nice, name: nice, global: false });
    kept.push(out);
    continue;
  }
  // otherwise drop the item for these years
  removed.push(it);
}

// write strict curated file for review
write(OUTSTRICT, kept.filter(k=> targetYears.includes(Number((k.date||'').slice(0,4)))));
// replace overrides for target years: merge kept with other years (kept array has all)
write(OVERRIDES, kept);

console.log('Simplification complete. Wrote strict curated file:', OUTSTRICT);
console.log('Rewrote overrides at', OVERRIDES, 'backup at', BACKUP);
console.log('Removed entries count for target years:', removed.length);
