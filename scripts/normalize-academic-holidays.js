const fs = require('fs');
const path = require('path');

const inPath = path.join(process.cwd(),'data','holidays-academic-2025-2026.json');
const outPath = path.join(process.cwd(),'data','holidays-academic-2025-2026-normalized.json');

function readJSON(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')||'[]'); } catch(e){ return []; }}
const items = readJSON(inPath);

const monthMap = {
  jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
  january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12
};

function pad(n){return String(n).padStart(2,'0');}

function dateToISO(y,m,d){ return `${y}-${pad(m)}-${pad(d)}`; }

function expandRangeSameMonth(startDay,endDay,month,year){
  const m = typeof month === 'string' ? monthMap[month.toLowerCase()] : Number(month);
  const arr = [];
  for(let d=Number(startDay); d<=Number(endDay); d++) arr.push(dateToISO(year,m,d));
  return arr;
}

function tryParseDatesFromText(text){
  const results = [];
  if(!text) return results;
  const t = text.replace(/\u00A0/g,' ');

  // ISO dates
  const isoRx = /(?<!\d)(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/g;
  let m;
  while((m=isoRx.exec(t))){
    results.push({date:dateToISO(m[1],Number(m[2]),Number(m[3])), label:extractLabelAround(t,m.index)});
  }

  // ranges like 25-31 Dec 2025 or 25 - 31 Dec 2025
  const rangeSameMonthRx = /(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/g;
  while((m=rangeSameMonthRx.exec(t))){
    const arr = expandRangeSameMonth(m[1],m[2],m[3],m[4]);
    for(const d of arr) results.push({date:d,label:extractLabelAround(t,m.index)});
  }

  // single date like 25 Dec 2025 or Dec 25, 2025
  const single1 = /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/g; // 25 Dec 2025
  while((m=single1.exec(t))){
    const mon = monthMap[m[2].toLowerCase()];
    if(!mon) continue;
    results.push({date:dateToISO(m[3],mon,m[1]), label:extractLabelAround(t,m.index)});
  }
  const single2 = /([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/g; // Dec 25, 2025
  while((m=single2.exec(t))){
    const mon = monthMap[m[1].toLowerCase()];
    if(!mon) continue;
    results.push({date:dateToISO(m[3],mon,m[2]), label:extractLabelAround(t,m.index)});
  }

  // remove duplicates
  const seen = new Set();
  const out = [];
  for(const r of results){
    if(!r.date) continue;
    const key = `${r.date}::${(r.label||'').slice(0,80)}`;
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function extractLabelAround(text,idx){
  // take up to 60 chars after the date occurrence, trim to next sentence break or up to 120 chars
  const after = text.slice(idx, idx+200).replace(/\s+/g,' ');
  const parts = after.split(/[\n\r]/)[0];
  return parts.trim();
}

const normalized = [];
for(const it of items){
  const source = it.localName || it.name || '';
  const parsed = tryParseDatesFromText(source);
  if(parsed.length === 0){
    // fallback: if item.date is already in ISO format, keep it
    if(it.date && /^\d{4}-\d{2}-\d{2}$/.test(it.date)){
      normalized.push({ date: it.date, localName: source, name: source, countryCode: it.countryCode||'IQ', fixed:false, global:false, sourceText: source });
    } else {
      // try extracting any ISO from the concatenated string
      const m = (source+" "+(it.name||'')).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if(m) normalized.push({ date: dateToISO(m[1],Number(m[2]),Number(m[3])), localName: source, name: source, countryCode: it.countryCode||'IQ', fixed:false, global:false, sourceText: source });
    }
  } else {
    for(const p of parsed){
      normalized.push({ date: p.date, localName: p.label || source, name: p.label || source, countryCode: it.countryCode||'IQ', fixed:false, global:false, sourceText: source });
    }
  }
}

// dedupe by date + name
const finalSeen = new Map();
for(const n of normalized){
  const k = `${n.date}::${(n.name||'').toLowerCase().slice(0,120)}`;
  if(finalSeen.has(k)) continue;
  finalSeen.set(k,n);
}
const final = Array.from(finalSeen.values()).sort((a,b)=>a.date.localeCompare(b.date));
fs.writeFileSync(outPath, JSON.stringify(final,null,2),'utf8');
console.log('Wrote', outPath, 'entries:', final.length);
