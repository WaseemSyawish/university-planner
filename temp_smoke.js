const fetch = require('node-fetch');
(async () => {
  const base = 'http://localhost:3002';
  try {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 60*60000).toISOString();
    const body = {
      title: 'smoke test event',
      date: start.slice(0,10),
      time: '09:00',
      durationMinutes: 60,
      startDate: start,
      endDate: end,
      color: '#00ff00',
      variant: 'default',
      userId: 'smoke_user'
    };
    console.log('POST /api/events body:', body);
    const post = await fetch(base + '/api/events?userId=smoke_user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('POST status', post.status);
    const postText = await (post.headers.get('content-type')||'').includes('json') ? await post.json() : await post.text();
    console.log('POST body:', postText);
    if (post.ok && postText && postText.event && postText.event.id) {
      const id = postText.event.id;
      const patchBody = { title: 'smoke test event [patched]', ...body };
      const patch = await fetch(base + '/api/events/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patchBody) });
      console.log('PATCH status', patch.status);
      const patchText = await (patch.headers.get('content-type')||'').includes('json') ? await patch.json() : await patch.text();
      console.log('PATCH body:', patchText);
    } else {
      console.log('POST did not return created event, skipping PATCH');
    }
  } catch (e) {
    console.error('error', e);
  }
})();
