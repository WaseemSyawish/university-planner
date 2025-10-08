const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const pdfPath = path.join(process.cwd(),'Academic-Year-2025-2026.pdf');
const outPath = path.join(process.cwd(),'data','holidays-academic-2025-2026.json');

async function run(){
  const buf = fs.readFileSync(pdfPath);
  const data = await pdf(buf);
  const text = data.text;
  // Look for lines that contain a date. We'll support formats like:
  // - 21 March 2025 - Spring Break
  // - Mar 21, 2025 — Holiday Name
  // - 2025-03-21  Holiday Name

  const monthNames = {
    jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
    january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12
  };
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const results = [];
  const dateRegexes = [
    /(?<yyyy>\d{4})[-/](?<mm>\d{1,2})[-/](?<dd>\d{1,2})/, // 2025-03-21
    /(?<dd>\d{1,2})[\s,.-]+(?<month>[A-Za-z]{3,9})[\s,.-]+(?<yyyy>\d{4})/, // 21 March 2025
    /(?<month>[A-Za-z]{3,9})[\s]+(?<dd>\d{1,2}),?[\s]+(?<yyyy>\d{4})/ // March 21, 2025
  ];

  for (const line of lines) {
    let matched = null;
    for (const rx of dateRegexes) {
      const m = line.match(rx);
      if (m && m.groups) { matched = m.groups; break; }
    }
    if (!matched) continue;
    let yyyy = matched.yyyy;
    let mm = matched.mm;
    let dd = matched.dd;
    if (!yyyy || !dd) continue;
    if (!mm) {
      const mname = (matched.month||'').toLowerCase();
      if (monthNames[mname]) mm = monthNames[mname];
      else continue;
    }
    const month = String(mm).padStart(2,'0');
    const day = String(dd).padStart(2,'0');
    const date = `${yyyy}-${month}-${day}`;
    // extract name from the rest of the line after the date
    const after = line.replace(new RegExp('.*' + (matched[0] ? matched[0].replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&') : matched[0])), '').trim();
    const name = after || line;
    results.push({ date, localName: name, name, countryCode: 'IQ', fixed: false, global: false });
  }

  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('Wrote', outPath, 'entries:', results.length);
}

run().catch(err=>{ console.error(err); process.exit(1); });
