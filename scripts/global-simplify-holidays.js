const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const files = fs.readdirSync(DATA_DIR).filter(f => /holidays.*\.json/i.test(f));

function backup(p){ const dest = p + '.simplify.bak.' + Date.now(); fs.copyFileSync(p,dest); return dest; }
function read(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }
function write(p,d){ fs.writeFileSync(p, JSON.stringify(d,null,2),'utf8'); }

const keywords = ['New Year','Newroz','Eid','Christmas','Assyrian','Yazidi','Yazidis','Labour','Uprising','Birthday','Baghdad Liberation','Prophet','Mustafa','Barzani','Easter','International Labour Day'];

function pickBestName(entry){
  const candSources = [];
  if(entry.name) candSources.push(entry.name);
  if(entry.localName) candSources.push(entry.localName);
  if(entry.sourceText) candSources.push(entry.sourceText);
  for(const s of candSources){
    if(!s || typeof s !== 'string') continue;
    const normalized = s.replace(/\s+/g,' ').trim();
    // if normalized is short (<30 chars) and has a keyword, use trimmed
    for(const kw of keywords){ if(normalized.toLowerCase().includes(kw.toLowerCase())){
        // return the keyword + any following short phrase
        const idx = normalized.toLowerCase().indexOf(kw.toLowerCase());
        let piece = normalized.slice(idx, idx + 40).split(/[\n\r]/)[0];
        piece = piece.replace(/\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/g,'').replace(/\d{4}/g,'').replace(/[^\w\s()\-]/g,'').trim();
        // shorten to first 4 words
        piece = piece.split(' ').slice(0,4).join(' ').trim();
        return piece;
    }}
  }
  // fallback: take entry.name but remove date fragments and long garbage
  if(entry.name && typeof entry.name === 'string'){
    const short = entry.name.replace(/\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/g,'').replace(/\d{4}/g,'').replace(/[^\w\s()\-]/g,'').replace(/\s+/g,' ').trim();
    return short.split(' ').slice(0,6).join(' ').trim();
  }
  return null;
}

const report = [];
for(const fileName of files){
  const p = path.join(DATA_DIR, fileName);
  const bak = backup(p);
  const arr = read(p);
  if(!Array.isArray(arr)){
    console.log('Skipping', fileName, '- not an array');
    continue;
  }
  let changed = 0;
  for(const e of arr){
    const before = {name:e.name, localName:e.localName, sourceText:e.sourceText||null};
    const best = pickBestName(e);
    if(best && best !== e.name){ e.name = best; e.localName = best; changed++; }
    report.push({file:fileName, before, after:{name:e.name, localName:e.localName}, changed: best && best !== before.name});
  }
  write(p, arr);
  console.log('Processed', fileName, 'backup:', bak, 'changed entries:', changed);
}
write(path.join(DATA_DIR,'global-simplify-report.json'), report);
console.log('Wrote global-simplify-report.json');
