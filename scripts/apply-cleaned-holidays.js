const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const masterFile = path.join(dataDir, 'holidays-iq-kurdistan.json');
const cleanedFile = path.join(dataDir, 'holidays-iq-kurdistan-strict-2025-2026.cleaned2.json');
const backup = masterFile + '.bak.' + Date.now();

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJSON(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8'); }

try {
  const master = readJSON(masterFile);
  const cleaned = readJSON(cleanedFile);
  fs.copyFileSync(masterFile, backup);
  console.log('Backup saved to', backup);
  // Determine years to replace from cleaned file
  const years = new Set(cleaned.map(e=> e.date && e.date.slice(0,4)));
  console.log('Replacing years:', Array.from(years).join(', '));
  // Filter master to remove entries in those years
  const filtered = master.filter(e => !years.has(e.date && e.date.slice(0,4)));
  // Merge: keep unique by date+name (case-insensitive)
  const mergedMap = new Map();
  for (const e of filtered) {
    const key = (e.date||'') + '||' + ((e.name||'').toLowerCase());
    mergedMap.set(key, e);
  }
  for (const e of cleaned) {
    const key = (e.date||'') + '||' + ((e.name||'').toLowerCase());
    mergedMap.set(key, e);
  }
  const merged = Array.from(mergedMap.values()).sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  writeJSON(masterFile, merged);
  console.log('Wrote merged holidays to', masterFile, 'entries=', merged.length);
} catch (err) {
  console.error('Error:', err && err.message);
  process.exit(1);
}
