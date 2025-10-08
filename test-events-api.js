// Simple smoke test for /api/events endpoints
// Usage: node test-events-api.js

const base = 'http://localhost:3000/api/events';

(async function(){
  try {
    console.log('Creating event...');
    const create = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Smoke test', date: new Date().toISOString(), userId: 'demo-user' })
    });
    const cbody = await create.json();
    console.log('Create status', create.status, cbody);

    if (!cbody || !cbody.event) return console.error('Create failed');

    const id = cbody.event.id;
    console.log('Fetching list...');
    const list = await (await fetch(base)).json();
    console.log('List status', list.success ? 'ok' : 'fail');

    console.log('Fetching single...');
    const single = await (await fetch(base + '/' + id)).json();
    console.log('Single:', single.success ? 'ok' : 'fail', single.event?.id);

    console.log('Patching (toggle completed)...');
    const patched = await (await fetch(base + '/' + id, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ completed: true }) })).json();
    console.log('Patched:', patched.success, patched.event?.completed);

    console.log('Deleting...');
    const deleted = await (await fetch(base + '/' + id, { method: 'DELETE' })).json();
    console.log('Deleted:', deleted.success, deleted.event?.id);

  } catch (err) {
    console.error('Smoke test failed:', err);
    process.exit(1);
  }
})();
