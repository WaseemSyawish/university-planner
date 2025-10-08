const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(process.cwd(), 'data');
const overridesFile = path.join(CACHE_DIR, 'holidays-iq-kurdistan.json');

function loadOverrides() {
  if (!fs.existsSync(overridesFile)) return [];
  try { return JSON.parse(fs.readFileSync(overridesFile, 'utf8') || '[]'); } catch(e) { console.error(e); return []; }
}

function filterByYears(list, years) {
  return list.filter(o => {
    try { const y = Number(String(o.date||'').slice(0,4)); return years.includes(y); } catch(e){ return false; }
  });
}

const years = [2024,2025,2026];
const overrides = loadOverrides();
const filtered = filterByYears(overrides, years);

// Dedupe by date+name
const seen = new Set();
const combined = [];
filtered.forEach(h => {
  const key = `${h.date}::${(h.localName||h.name||'').toLowerCase()}`;
  if (!seen.has(key)) { seen.add(key); combined.push(h); }
});

console.log('Years:', years.join(','));
console.log('Overrides loaded:', overrides.length);
console.log('Filtered overrides for years:', filtered.length);
console.log('Deduped combined:', combined.length);
console.log('Sample:', combined.slice(0,8));
