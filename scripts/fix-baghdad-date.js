const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'holidays-iq-kurdistan.json');
const backup = file + '.pre-baghdadfix.bak.' + Date.now();

function monthNum(mon){
  const map = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12,
    January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};
  return map[mon] || map[mon.substring(0,3)];
}

function toISO(tok){
  const mRange = tok.match(/(\d{1,2})[-–](\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if(mRange){ return `${mRange[4]}-${String(monthNum(mRange[3])).padStart(2,'0')}-${String(mRange[2]).padStart(2,'0')}`; }
  const m = tok.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if(m){ return `${m[3]}-${String(monthNum(m[2])).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`; }
  return null;
}

try{
  const raw = fs.readFileSync(file,'utf8');
  const data = JSON.parse(raw);
  fs.copyFileSync(file, backup);
  console.log('Backup to', backup);
  let changed = 0;
  for(const e of data){
    if(!(e.sourceText && typeof e.sourceText === 'string') ) continue;
    if(!/baghdad liberation day/i.test(e.sourceText)) continue;
    // normalize missing spaces between words and digits
    let s = e.sourceText.replace(/(\d{4})(?=[A-Za-z])/g,'$1 ').replace(/([A-Za-z])(?=\d)/g,'$1 ');
    // find the match for 'Baghdad Liberation Day' and date tokens before it
    const nameIdx = s.toLowerCase().indexOf('baghdad liberation');
    if(nameIdx === -1) continue;
    const datePattern = /\b\d{1,2}(?:[-–]\d{1,2})?\s+[A-Za-z]{3,9}\s+\d{4}\b/g;
    let m; const matches = [];
    while((m = datePattern.exec(s)) !== null){ matches.push({text:m[0], idx:m.index}); }
    // pick last match before nameIdx
    const before = matches.filter(x=> x.idx < nameIdx);
    if(before.length){
      const chosen = before[before.length-1].text;
      const iso = toISO(chosen);
      if(iso && iso !== e.date){ e.date = iso; changed++; console.log('Updated', e.name, '->', iso); }
    }
  }
  // dedupe
  const map = new Map();
  for(const e of data){ const key = (e.date||'')+'||'+((e.name||'').toLowerCase()); if(!map.has(key)) map.set(key,e); }
  const merged = Array.from(map.values()).sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  fs.writeFileSync(file, JSON.stringify(merged,null,2),'utf8');
  console.log('Wrote', file, 'entries=', merged.length, 'changed=', changed);
} catch(err){ console.error(err && err.message); process.exit(1); }
