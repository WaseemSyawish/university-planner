// posts a repeating event with materializeCount to local /api/events
const fetch = require('node-fetch');

(async function main(){
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const now = new Date();
  const start = new Date(now.getTime() + 1000 * 60 * 60 * 24); // tomorrow
  start.setHours(9,0,0,0);
  const end = new Date(start.getTime() + 1000 * 60 * 60 * 2 + 1000 * 60 * 30); // +2.5h

  const body = {
    title: `Materialize test ${Date.now()}`,
    date: `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`,
    time: `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    durationMinutes: Math.round((end - start) / 60000),
    repeatOption: 'weekly',
    materialize: true,
    materializeCount: 3,
    type: 'personal'
  };

  try {
    const res = await fetch(baseUrl + '/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const txt = await res.text();
    try { console.log(JSON.stringify(JSON.parse(txt), null, 2)); } catch (e) { console.log(txt); }
  } catch (e) {
    console.error('POST failed:', e.message);
    process.exit(1);
  }
})();
