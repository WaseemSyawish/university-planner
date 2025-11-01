(async () => {
  const fetch = global.fetch || (await import('node-fetch')).default;
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/apply-scoped-patch.js <eventId> <scope> [jsonBody]');
    process.exit(2);
  }
  const [id, scope, bodyStr] = args;
  const body = bodyStr ? JSON.parse(bodyStr) : { title: `APPLY-SCOPED-${Date.now()}` };
  const url = `http://localhost:3000/api/events/${encodeURIComponent(id)}?scope=${encodeURIComponent(scope)}`;
  console.log('PATCH', url, 'body', body);
  try {
    const resp = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const txt = await resp.text();
    console.log('status', resp.status);
    console.log(txt.slice(0, 2000));
  } catch (e) {
    console.error('Request failed (local dev server must be running):', e.message || e);
  }
})();
