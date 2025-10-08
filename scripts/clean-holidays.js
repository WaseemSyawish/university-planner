const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'data', 'holidays-iq-kurdistan-strict-2025-2026.json');
const backup = target + '.bak.' + Date.now();
const out = target.replace('.json', '.cleaned.json');

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function cleanName(s) {
  if (!s || typeof s !== 'string') return '';
  let out = s;
  // Remove date ranges like '11-22 Jan 2026' or '25-31 Dec 2025'
  out = out.replace(/\b\d{1,2}[-–]\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/g, '');
  // Remove single dates like '01 Jan 2026' or '9 Feb 2026'
  out = out.replace(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/g, '');
  // Remove year-first formats like '2025-09-24' if present
  out = out.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '');
  // Remove stray years
  out = out.replace(/\b\d{4}\b/g, '');
  // Remove multiple contiguous whitespace
  out = out.replace(/\s+/g, ' ').trim();
  // If it still contains commas/digits that look like concatenated source text, try to cut after common holiday words
  // But first, if it looks like an obvious academic entry, return empty
  if (/semester|exam|resit|re-sit|resit exams|final exams|exam boards/i.test(out)) return '';
  // If the cleaned string is empty or looks numeric, return empty
  if (!out || /^\d+$/.test(out)) return '';
  return out;
}

function process(arr) {
  const byDate = new Map();
  for (const e of arr) {
    const date = e.date;
    const rawName = e.name || '';
    const rawLocal = e.localName || '';
    const cleanedName = cleanName(rawName) || cleanName(rawLocal) || '';
    // If cleanedName is empty, skip entries that look like academic schedule
    if (!cleanedName) {
      // Keep entries that have a clear holiday in sourceText? simple heuristic: if sourceText contains 'New Year|Christmas|Eid|Newroz|Birthday|Labour|Uprising|Baghdad|Assyrian|Yazidis' keep
      const keeper = /New Year|Christmas|Eid|Newroz|Birthday|Labour|Uprising|Baghdad|Assyrian|Yazidis|Prophet|Mustafa|Barzani|Assyrian/i;
      if (!keeper.test((e.sourceText||'') + ' ' + rawName + ' ' + rawLocal)) {
        // drop this entry
        continue;
      }
    }
    const finalName = cleanedName || (e.localName || e.name || 'Holiday');
    const key = date + '||' + finalName.toLowerCase();
    if (!byDate.has(key)) {
      const clone = Object.assign({}, e);
      clone.name = finalName;
      clone.localName = finalName;
      byDate.set(key, clone);
    }
  }
  return Array.from(byDate.values()).sort((a,b)=> a.date.localeCompare(b.date));
}

try {
  const data = readJSON(target);
  fs.copyFileSync(target, backup);
  console.log('Backup written to', backup);
  const cleaned = process(data);
  writeJSON(out, cleaned);
  console.log('Cleaned file written to', out, 'original entries=', data.length, 'cleaned=', cleaned.length);
} catch (err) {
  console.error('Error:', err && err.message);
  process.exit(1);
}
