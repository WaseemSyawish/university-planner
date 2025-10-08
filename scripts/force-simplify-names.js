const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const files = fs.readdirSync(DATA_DIR).filter(f => /holidays.*\.json/i.test(f));

const canonical = {
  'new year': "New Year's Day",
  'newroz': 'Newroz',
  'eid': 'Eid',
  'eid al-fitr': 'Eid al-Fitr',
  'eid al-adha': 'Eid al-Adha',
  'christmas': 'Christmas Day',
  'assyrian new year': 'Assyrian New Year',
  'yazidi': 'Yazidis New Year',
  'yazidis': 'Yazidis New Year',
  'international labour day': 'International Labour Day',
  'labour': 'International Labour Day',
  'uprising': 'Uprising Day',
  'baghdad liberation': 'Baghdad Liberation Day',
  'prophet': 'Birthday of Prophet Mohammed (PBUH)',
  'birthday of prophet': 'Birthday of Prophet Mohammed (PBUH)',
  'mustafa barzani': 'Birthday of Mustafa Barzani',
  'easter': 'Easter',
  'christmas day': 'Christmas Day',
  'assyrian': 'Assyrian New Year',
  'international labour': 'International Labour Day'
};

function backup(p){ const dest = p + '.force-simplify.bak.' + Date.now(); fs.copyFileSync(p,dest); return dest; }
function read(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }
function write(p,d){ fs.writeFileSync(p, JSON.stringify(d,null,2),'utf8'); }

function normalize(s){ return (s||'').replace(/\s+/g,' ').replace(/(\d{4})(?=[A-Za-z])/g,'$1 ').trim(); }
function removeDateFragments(s){ return (s||'').replace(/\b\d{1,2}[-–]\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/g,'').replace(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/g,'').replace(/\b\d{4}\b/g,'').replace(/\s+/g,' ').trim(); }

const reports = [];
for(const fileName of files){
  const p = path.join(DATA_DIR, fileName);
  const bak = backup(p);
  try{
    const arr = read(p);
    if(!Array.isArray(arr)) continue;
    let changedCount = 0;
    for(const e of arr){
      const beforeName = e.name || '';
      const beforeLocal = e.localName || '';
      const combined = ((e.name||'') + ' ' + (e.localName||'') + ' ' + (e.sourceText||'')).toLowerCase();
      let found = null;
      // prefer longest canonical key present
      const keys = Object.keys(canonical).sort((a,b)=> b.length - a.length);
      for(const k of keys){ if(combined.includes(k)) { found = canonical[k]; break; } }
      if(found){
        if((e.name||'') !== found){ e.name = found; }
        if((e.localName||'') !== found){ e.localName = found; }
      } else {
        // fallback: if name looks messy (contains digits or long >50 or has concatenated dates), simplify
        const nameHasDate = /\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/.test(e.name||'') || /\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/.test(e.localName||'');
        const nameLong = (e.name||'').length > 50;
        if(nameHasDate || nameLong){
          // extract from sourceText the best keyword substring
          const candidate = removeDateFragments(e.sourceText || e.name || e.localName || '');
          const words = candidate.split(/\s+/).filter(Boolean);
          const take = words.slice(0,6).join(' ');
          const final = take || removeDateFragments(e.name) || 'Holiday';
          if(e.name !== final){ e.name = final; }
          if(e.localName !== final){ e.localName = final; }
        }
      }
      if(e.name !== beforeName || e.localName !== beforeLocal){
        changedCount++;
        reports.push({file:fileName, before:{name:beforeName, localName:beforeLocal}, after:{name:e.name, localName:e.localName}});
      }
    }
    write(p, arr);
    console.log('Simplified', fileName, 'backup:', bak, 'changed:', changedCount);
  } catch(err){ console.error('Failed', fileName, err && err.message); }
}
write(path.join(DATA_DIR,'force-simplify-report.json'), reports);
console.log('Wrote force-simplify-report.json with', reports.length, 'entries');
