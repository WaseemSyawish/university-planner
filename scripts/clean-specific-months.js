const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'holidays-iq-kurdistan.json');
const backup = file + '.pre-specificclean.bak.' + Date.now();

function read(){ return JSON.parse(fs.readFileSync(file,'utf8')); }
function write(d){ fs.writeFileSync(file, JSON.stringify(d,null,2),'utf8'); }

function normalizeName(s){
  if(!s) return s;
  let out = s.replace(/\s+/g,' ').trim();
  // remove concatenated date fragments like '01 Jan 2026' inside text
  out = out.replace(/\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/g,'').replace(/\d{4}/g,'');
  // ensure punctuation spacing e.g. 'Day25 Dec' -> 'Day - 25 Dec' (but we removed dates above)
  out = out.replace(/\s*[,;:\-]\s*/g, ', ');
  out = out.replace(/\s+\)/g,')').replace(/\(\s+/g,'(');
  out = out.replace(/\s+\//g,'/').replace(/\s+-\s+/g,' - ');
  return out.trim();
}

function extractHolidayFromSource(src){
  if(!src) return null;
  const keywords = /(New Year|Newroz|Eid|Christmas|Assyrian|Yazidi|Yazidis|Labour|Uprising|Birthday|Baghdad Liberation|Prophet|Mustafa|Barzani)/i;
  const m = src.match(keywords);
  if(m) return m[0];
  return null;
}

try{
  const data = read();
  fs.copyFileSync(file, backup);
  console.log('Backup to', backup);
  const monthsToFix = new Set(['2025-09','2025-10','2026-05','2026-06']);
  let changed = 0;
  for(const e of data){
    if(!e.date) continue;
    const prefix = e.date.slice(0,7);
    if(!monthsToFix.has(prefix)) continue;
    const origName = e.name || '';
    let newName = normalizeName(e.name) || normalizeName(e.localName) || '';
    if((!newName || newName.length<3) && e.sourceText){
      const ext = extractHolidayFromSource(e.sourceText);
      if(ext) newName = ext;
    }
    if(newName && newName !== origName){ e.name = newName; e.localName = newName; changed++; }
  }
  // write
  write(data);
  console.log('Wrote', file, 'entries=', data.length, 'changed=', changed);
} catch(err){ console.error(err && err.message); process.exit(1); }
