(async () => {
  const base = process.env.BASE || 'http://localhost:3001';
  try {
  // Do not pass userId from client-side. Server will resolve identity from next-auth session.
  const res = await fetch(`${base}/api/events`);
    console.log('GET status', res.status);
    const j = await res.json();
    console.log('events', (j.events || []).slice(0, 3).map(e => ({ id: e.id, title: e.title, date: e.date })));
    if (!(j.events || []).length) return console.log('no events');
    const id = j.events[0].id;
    console.log('patching', id);
    const p = await fetch(`${base}/api/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'patched-via-cli', date: j.events[0].date })
    });
    console.log('PATCH status', p.status);
    try {
      const pb = await p.json();
      console.log('PATCH body', pb);
    } catch (e) {
      console.log('PATCH no-json');
    }
  } catch (e) {
    console.error('ERROR', e);
  }
})();
