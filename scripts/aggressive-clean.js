const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'holidays-iq-kurdistan.json');
const backup = file + '.aggressive.bak.' + Date.now();
const reportFile = path.join(__dirname, '..', 'data', 'holidays-aggressive-clean-report.json');

function read(){ return JSON.parse(fs.readFileSync(file,'utf8')); }
function write(d){ fs.writeFileSync(file, JSON.stringify(d,null,2),'utf8'); }
function writeReport(d){ fs.writeFileSync(reportFile, JSON.stringify(d,null,2),'utf8'); }

const monthMap = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12,
  January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};

function isoFromToken(tok){
  tok = tok.trim();
  const r1 = tok.match(/^(\d{1,2})[-–](\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if(r1){ const day=r1[2], mon=r1[3], yr=r1[4]; const mm = monthMap[mon] || monthMap[mon.substring(0,3)]; return `${yr}-${String(mm).padStart(2,'0')}-${String(day).padStart(2,'0')}`; }
  const r2 = tok.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if(r2){ const day=r2[1], mon=r2[2], yr=r2[3]; const mm = monthMap[mon] || monthMap[mon.substring(0,3)]; return `${yr}-${String(mm).padStart(2,'0')}-${String(day).padStart(2,'0')}`; }
  return null;
}

function normalizeWhitespace(s){ return s.replace(/\s+/g,' ').trim(); }

function removeDateFragments(s){ if(!s) return s; return s.replace(/\b\d{1,2}[-–]\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/g,'').replace(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/g,'').replace(/\b\d{4}\b/g,'').replace(/\s+/g,' ').trim(); }

function cleanNameCandidate(rawName, rawLocal, src){
  let cand = (rawName && rawName.trim()) || (rawLocal && rawLocal.trim()) || '';
  cand = normalizeWhitespace(cand);
  // remove obvious academic tokens
  if(/semester|exam|resit|re-sit|final exams|exam boards|make up classes|review week/i.test(cand)) cand = '';
  // strip date fragments
  cand = removeDateFragments(cand);
  // if empty, try extracting from sourceText near known keywords
  if((!cand || cand.length < 2) && src){
    // normalize glue: insert space after year when letters follow
    let s = src.replace(/(\d{4})(?=[A-Za-z])/g, '$1 ').replace(/([A-Za-z])(?=\d)/g,'$1 ');
    // try to find best keyword matches
    const keywords = ['New Year','Newroz','Eid','Christmas','Assyrian','Yazidi','Yazidis','Labour','Uprising','Birthday','Baghdad Liberation','Prophet','Mustafa','Barzani','Easter'];
    for(const kw of keywords){
      const idx = s.toLowerCase().indexOf(kw.toLowerCase());
      if(idx !== -1){
        // take substring from idx to end of line or 60 chars
        let piece = s.slice(idx, idx + 80).split(/[\n\r]/)[0];
        piece = removeDateFragments(piece);
        piece = piece.replace(/[^\w\s()\-\/,\.]/g,'').trim();
        if(piece.length > 1) return piece;
      }
    }
  }
  // final cleanup: punctuation spacing
  cand = cand.replace(/\s*[,;:\-]\s*/g, ', ').replace(/\s+\)/g,')').replace(/\(\s+/g,'(').replace(/\s+\//g,'/').replace(/\s+-\s+/g,' - ');
  cand = cand.trim();
  // if still too short or looks numeric, return null
  if(!cand || cand.length < 2 || /^\d+$/.test(cand)) return null;
  return cand;
}

function extractDatesFromSource(src){
  if(!src) return [];
  const s = src.replace(/(\d{4})(?=[A-Za-z])/g,'$1 ').replace(/([A-Za-z])(?=\d)/g,'$1 ');
  const re = /\b\d{1,2}(?:[-–]\d{1,2})?\s+[A-Za-z]{3,9}\s+\d{4}\b/g;
  const out = [];
  let m;
  while((m = re.exec(s)) !== null){ out.push({text:m[0], index:m.index}); }
  return out;
}

function inWindow(dateStr){ // between 2025-09-01 and 2026-08-31 inclusive
  if(!dateStr) return false;
  const d = dateStr.slice(0,10);
  return d >= '2025-09-01' && d <= '2026-08-31';
}

try{
  const data = read();
  fs.copyFileSync(file, backup);
  console.log('Backup created at', backup);

  // split data into outside and inside window
  const outside = data.filter(e => !inWindow(e.date));
  const inside = data.filter(e => inWindow(e.date));

  const report = [];
  const cleanedMap = new Map();

  for(const e of inside){
    const before = {date:e.date, name:e.name, localName:e.localName, sourceText:e.sourceText || null};
    // normalize sourceText whitespace/punctuation
    let src = e.sourceText || '';
    src = normalizeWhitespace(src.replace(/(\d{4})(?=[A-Za-z])/g,'$1 ').replace(/([A-Za-z])(?=\d)/g,'$1 '));
    // find date tokens
    const dateTokens = extractDatesFromSource(src);
    // pick date token closest before name or last token
    let chosenDate = null;
    if(dateTokens.length){
      // if holiday name appears in sourceText, pick last token before it
      const nameLower = (e.name || e.localName || '').toLowerCase();
      const idx = src.toLowerCase().indexOf(nameLower);
      if(idx !== -1){
        let cand = null;
        for(const dt of dateTokens){ if(dt.index < idx) cand = dt; }
        if(!cand) cand = dateTokens[dateTokens.length-1];
        chosenDate = isoFromToken(cand.text);
      } else {
        chosenDate = isoFromToken(dateTokens[dateTokens.length-1].text);
      }
    }

    // build cleaned name
    const newName = cleanNameCandidate(e.name, e.localName, src) || e.name || e.localName || null;
    // normalize name punctuation
    const normName = newName ? normalizeWhitespace(newName).replace(/\s*[,;:\-]\s*/g, ', ').trim() : null;

    // Decide action
    const after = {date: chosenDate || e.date, name: normName, localName: normName, sourceText: src || null};

    // drop entries that are clearly academic-only (no holiday keywords and name null)
    const holidayKeywords = /(New Year|Newroz|Eid|Christmas|Assyrian|Yazidi|Yazidis|Labour|Uprising|Birthday|Baghdad Liberation|Prophet|Mustafa|Barzani|Easter)/i;
    const keep = (after.name && holidayKeywords.test(after.name)) || (src && holidayKeywords.test(src));
    if(!keep){ report.push({before, after:null, action:'dropped - academic/no holiday keyword'}); continue; }

    // set finalDate
    const finalDate = after.date;
    if(!finalDate){ report.push({before, after:null, action:'dropped - no date'}); continue; }

    const key = finalDate + '||' + (after.name ? after.name.toLowerCase() : '');
    if(cleanedMap.has(key)){
      // duplicate; skip and report
      report.push({before, after:{date:finalDate,name:after.name,localName:after.localName,sourceText:after.sourceText}, action:'deduplicated - duplicate key'});
      continue;
    }

    cleanedMap.set(key, {date:finalDate, name:after.name, localName:after.localName, countryCode:e.countryCode||'IQ', counties:e.counties||[], fixed: !!e.fixed, global: !!e.global, sourceText: after.sourceText});
    report.push({before, after:{date:finalDate, name:after.name, localName:after.localName, sourceText:after.sourceText}, action:'kept/cleaned'});
  }

  // compose new master list: outside + cleanedMap values, sorted
  const merged = outside.concat(Array.from(cleanedMap.values())).sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  write(merged);
  writeReport(report);

  console.log('Aggressive clean applied. Entries before=', data.length, 'after=', merged.length, 'report=', reportFile);
} catch(err){ console.error('Error', err && err.message); process.exit(1); }
