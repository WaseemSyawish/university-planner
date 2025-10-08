const fs = require('fs');
const path = require('path');

const input = path.join(__dirname, '..', 'data', 'holidays-iq-kurdistan-strict-2025-2026.cleaned.json');
const out = input.replace('.cleaned.json', '.cleaned2.json');
const backup = input + '.bak.' + Date.now();

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJSON(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8'); }

function extractHolidayFromSource(src) {
  if (!src) return null;
  // Heuristic: common holiday keywords
  const holidayKeywords = /New Year|Newroz|Eid|Christmas|Assyrian|Yazidis|Labour|Uprising|Birthday|Baghdad Liberation|Prophet|Mustafa|Barzani|Yazidi/i;
  if (holidayKeywords.test(src)) {
    // Try to extract the subsection after the last year token
    // split on year patterns and take last segment
    const parts = src.split(/\d{4}/);
    let candidate = parts[parts.length-1] || src;
    candidate = candidate.replace(/^[^A-Za-z]+/, '').replace(/[^A-Za-z0-9\s\-(),\/]+$/, '').trim();
    // If candidate still not matching keywords, search for first keyword match in src
    if (!holidayKeywords.test(candidate)) {
      const m = src.match(holidayKeywords);
      if (m) return m[0];
    }
    return candidate || null;
  }
  return null;
}

function cleanEntry(e) {
  const out = Object.assign({}, e);
  // Remove date ranges or glued tokens in name/localName
  out.name = (out.name||'').replace(/\d{1,2}[-–]\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/g,'').replace(/\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/g,'').replace(/\d{4}/g,'').replace(/\s+/g,' ').trim();
  out.localName = (out.localName||'').replace(/\d{1,2}[-–]\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/g,'').replace(/\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/g,'').replace(/\d{4}/g,'').replace(/\s+/g,' ').trim();
  // If name now looks like academic leftover (contains 'Semester' or 'Exam') try to get from sourceText
  if (/semester|exam|board|resit|final exams|make up/i.test(out.name+ ' ' + out.localName)) {
    const found = extractHolidayFromSource(out.sourceText || '');
    if (found) {
      out.name = found;
      out.localName = found;
    } else {
      // drop this entry by returning null
      return null;
    }
  }
  // If name is empty but sourceText contains holiday, extract
  if ((!out.name || out.name.length<2) && out.sourceText) {
    const found = extractHolidayFromSource(out.sourceText);
    if (found) {
      out.name = found; out.localName = found;
    } else {
      return null;
    }
  }
  return out;
}

try {
  const data = readJSON(input);
  fs.copyFileSync(input, backup);
  const cleaned = data.map(cleanEntry).filter(Boolean);
  writeJSON(out, cleaned);
  console.log('Wrote', out, 'orig=', data.length, 'cleaned=', cleaned.length, 'backup=', backup);
} catch (err) {
  console.error(err && err.message);
  process.exit(1);
}
