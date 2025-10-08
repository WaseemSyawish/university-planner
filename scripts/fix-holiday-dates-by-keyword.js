const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'holidays-iq-kurdistan.json');
const backup = file + '.pre-keywordfix.bak.' + Date.now();

const monthMap = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12,
  January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};

function parseDateToken(tok){
  tok = tok.trim();
  const rangeMatch = tok.match(/^(\d{1,2})[-–](\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if(rangeMatch){
    const day = rangeMatch[2]; const mon = rangeMatch[3]; const yr = rangeMatch[4];
    const mm = monthMap[mon] || monthMap[mon.substring(0,3)];
    return `${yr}-${String(mm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  const m = tok.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if(m){
    const day = m[1]; const mon = m[2]; const yr = m[3];
    const mm = monthMap[mon] || monthMap[mon.substring(0,3)];
    return `${yr}-${String(mm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  return null;
}

try{
  const raw = fs.readFileSync(file,'utf8');
  const data = JSON.parse(raw);
  fs.copyFileSync(file, backup);
  console.log('Backup written to', backup);

  const datePattern = /\b\d{1,2}(?:[-–]\d{1,2})?\s+[A-Za-z]{3,9}\s+\d{4}\b/g;
  let changed = 0;

  const out = data.map(entry => {
    if(!entry.sourceText || !entry.name) return entry;
    let src = entry.sourceText;
    // normalize glued tokens
    src = src.replace(/(\d{4})(?=[A-Za-z])/g,'$1 ');
    // find position of the holiday name in sourceText
    const nameIdx = src.toLowerCase().indexOf((entry.name || '').toLowerCase());
    if(nameIdx === -1){
      // try shorter name (first few words)
      const short = (entry.name||'').split(' ').slice(0,3).join(' ');
      if(short && src.toLowerCase().indexOf(short.toLowerCase()) !== -1) {
        // recalc
      }
    }
    if(nameIdx !== -1){
      // collect all date matches with positions
      const matches = [];
      let m;
      while((m = datePattern.exec(src)) !== null){
        matches.push({text: m[0], index: m.index});
      }
      // find last date match that occurs before nameIdx
      let chosen = null;
      for(const mm of matches){
        if(mm.index < nameIdx) chosen = mm;
      }
      if(chosen){
        const parsed = parseDateToken(chosen.text);
        if(parsed && parsed !== entry.date){
          entry.date = parsed;
          changed++;
        }
      }
    }
    return entry;
  });

  // dedupe by date+name
  const map = new Map();
  for(const e of out){
    const key = (e.date||'') + '||' + ((e.name||'').toLowerCase());
    if(!map.has(key)) map.set(key, e);
  }
  const merged = Array.from(map.values()).sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  fs.writeFileSync(file, JSON.stringify(merged, null,2),'utf8');
  console.log('Wrote', file, 'entries=', merged.length, 'dates changed=', changed);
} catch(err){
  console.error('Error', err && err.message);
  process.exit(1);
}
