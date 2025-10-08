// POST a test event to the local Next dev server using global fetch (Node 18+)
(async function(){
  const url = 'http://127.0.0.1:3001/api/events';
  const payload = {
    title: 'Automated Test Event',
    type: 'assignment',
    date: '2025-01-01',
    time: '12:00',
    description: 'Created by scripts/send-post.js',
    userId: 'aef344d3-e602-402d-85de-055ba3c4629b'
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log('STATUS', res.status);
    console.log('HEADERS', JSON.stringify(Object.fromEntries(res.headers.entries())));
    console.log('BODY', text);
  } catch (err) {
    console.error('Request failed:', err);
    process.exit(1);
  }
})();
