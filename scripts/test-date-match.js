const fs = require('fs');
const path = require('path');

function formatDateKey(d) {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  let dt;
  if (typeof d === 'string') dt = new Date(d);
  else if (d instanceof Date) dt = d;
  else return '';
  if (isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const eventsFile = path.join(process.cwd(), 'data', 'events.json');
if (!fs.existsSync(eventsFile)) {
  console.error('events.json not found');
  process.exit(2);
}
const raw = fs.readFileSync(eventsFile, 'utf8');
const parsed = JSON.parse(raw);
const events = parsed.events || [];

const target = process.argv[2] || (new Date()).toISOString().slice(0,10);
console.log('Target date key:', target);

const matches = events.filter(ev => formatDateKey(ev.date) === target);
console.log('Matches:', matches.length);
matches.forEach(ev => console.log('-', ev.id, ev.title, ev.date));
