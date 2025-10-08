const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(),'data');
const overridesFile = path.join(dataDir,'holidays-iq-kurdistan.json');
const normalizedFile = path.join(dataDir,'holidays-academic-2025-2026-normalized.json');
const backupFile = path.join(dataDir,'holidays-iq-kurdistan.auto-fix.bak');
const reportFile = path.join(dataDir,'holidays-auto-fix-report.json');

function read(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')||'[]'); }catch(e){return [];}}
function write(p,o){ fs.writeFileSync(p, JSON.stringify(o,null,2),'utf8'); }

if(!fs.existsSync(overridesFile)) { console.error('overrides not found:', overridesFile); process.exit(1); }
const overrides = read(overridesFile);
const normalized = fs.existsSync(normalizedFile) ? read(normalizedFile) : [];

if(!fs.existsSync(backupFile)) fs.copyFileSync(overridesFile, backupFile);

const holidayKeywords = [
  {k:['eid al-fitr','eid al-fitr (approx)','eid al-fitr (approx)'],'name':'Eid al-Fitr'},
  {k:['eid al-adha','eid al-adha (approx)'],'name':'Eid al-Adha'},
  {k:['eid'],'name':'Eid'},
  {k:['newroz','nawroz','nawroz kurdish'],'name':'Newroz'},
  {k:['christmas'],'name':'Christmas Day'},
  {k:['assyrian'],'name':'Assyrian New Year'},
  {k:['independence'],'name':'Independence Day'},
  {k:['uprising'],'name':'Uprising Day'},
  {k:['birthday of prophet','mawlid','prophet'],'name':'Birthday of Prophet Mohammed (PBUH)'},
  {k:['yazidi'],'name':'Yazidis New Year'},
  {k:['easter'],'name':'Easter'},
  {k:['labour'],'name':'International Labour Day'},
  {k:['new year'],'name':'New Year\'s Day'},
  {k:['baghdad liberation'],'name':'Baghdad Liberation Day'},
  {k:['republic day','july revolution'],'name':'July Revolution (Republic Day)'}
];

const firstKeywords = ['first day of','first day','first day -','first day of semester'];
const lastKeywords = ['last day','last day of','last day of semester','end of semester','final exams','final exam','end of term'];
const returnKeywords = ['return to','resume','restart','return','return to classes','resume classes','return to classes (after)'];

function containsAny(s, arr){ if(!s) return false; const low = s.toLowerCase(); return arr.some(k=>low.includes(k)); }

// Collect canonical holiday dates from normalized
const holidayMap = new Map(); // key: canonical name -> Set of dates
for(const it of normalized){
  const text = ((it.localName||'') + ' ' + (it.name||'') + ' ' + (it.sourceText||'')).toLowerCase();
  for(const hk of holidayKeywords){
    for(const kw of hk.k){
      if(text.includes(kw)){
        if(!holidayMap.has(hk.name)) holidayMap.set(hk.name, new Set());
        holidayMap.get(hk.name).add(it.date);
      }
    }
  }
}

// Build newOverrides: keep all entries outside 2025/2026, and for 2025/2026 only keep holidays/first/last/return
const targetYears = [2025,2026];
const outside = overrides.filter(o => { const y = Number((o.date||'').slice(0,4)); return !targetYears.includes(y); });
const kept = [...outside];
const added = [];
const removed = [];

// Build set of dates already added to avoid duplicates
const seen = new Set(outside.map(o => `${o.date}::${(o.localName||o.name||'').toLowerCase()}`));

// 1) Add holidays from normalized canonical map for target years
for(const [name, dates] of holidayMap.entries()){
  for(const d of Array.from(dates)){
    const y = Number(d.slice(0,4));
    if(!targetYears.includes(y)) continue;
    const key = `${d}::${name.toLowerCase()}`;
    if(seen.has(key)) continue;
    const entry = { date: d, localName: name, name: name, counties: [], countryCode: 'IQ', fixed:false, global:true, source: 'academic-extract' };
    kept.push(entry); added.push({type:'add', entry}); seen.add(key);
  }
}

// 2) From overrides original, find first/last/return entries in target years and include simplified versions
for(const o of overrides){
  const y = Number((o.date||'').slice(0,4));
  if(!targetYears.includes(y)) continue;
  const text = ((o.localName||'') + ' ' + (o.name||'') + ' ' + (o.sourceText||'')).toLowerCase();
  if(containsAny(text, firstKeywords)){
    const name = 'First Day of Semester';
    const key = `${o.date}::${name.toLowerCase()}`;
    if(!seen.has(key)){
      const entry = { date: o.date, localName: name, name: name, counties: [], countryCode: 'IQ', fixed:false, global:false, source:'academic-override' };
      kept.push(entry); added.push({type:'add', entry}); seen.add(key);
    }
    continue;
  }
  if(containsAny(text, lastKeywords)){
    const name = 'Last Day of Semester';
    const key = `${o.date}::${name.toLowerCase()}`;
    if(!seen.has(key)){
      const entry = { date: o.date, localName: name, name: name, counties: [], countryCode: 'IQ', fixed:false, global:false, source:'academic-override' };
      kept.push(entry); added.push({type:'add', entry}); seen.add(key);
    }
    continue;
  }
  if(containsAny(text, returnKeywords)){
    const name = 'Return to Classes (after holidays)';
    const key = `${o.date}::${name.toLowerCase()}`;
    if(!seen.has(key)){
      const entry = { date: o.date, localName: name, name: name, counties: [], countryCode: 'IQ', fixed:false, global:false, source:'academic-override' };
      kept.push(entry); added.push({type:'add', entry}); seen.add(key);
    }
    continue;
  }
  // otherwise this override is removed for target years
  removed.push(o);
}

// Sort kept by date
kept.sort((a,b)=> (a.date||'').localeCompare(b.date||''));

write(overridesFile, kept);
write(reportFile, { added, removedCount: removed.length, removedSample: removed.slice(0,10) });

console.log('Auto-fix complete. Backup at', backupFile);
console.log('Added entries:', added.length, 'Removed entries for target years:', removed.length);
console.log('Report written to', reportFile);
