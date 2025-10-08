/*
Simple smoke test for the events API that runs against a running dev server.
Usage:
  1. Start the dev server: npm run dev
  2. In another terminal run: node scripts/smoke_test_events.js

This script will create a date-only event, create a timed event, fetch them back, update one, and then delete them.
It uses the public API endpoints under /api/events. The script is intentionally conservative with timings
to avoid triggering server-side "minimum schedule offset" validation for timed events.

Note: the script assumes the dev server is at http://localhost:3000. If your server runs elsewhere, set the
BASE_URL environment variable when running the script, e.g.
  BASE_URL=http://localhost:3001 node scripts/smoke_test_events.js
*/

const http = require('http');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

function request(path, method = 'GET', body) {
  const url = new URL(path, BASE);
  const data = body ? JSON.stringify(body) : null;
  const headers = { 'Content-Type': 'application/json' };
  const options = {
    method,
    headers,
  };

  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let chunks = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        try {
          const parsed = chunks ? JSON.parse(chunks) : null;
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
          const err = new Error(`HTTP ${res.statusCode}: ${res.statusMessage} - ${chunks}`);
          err.status = res.statusCode;
          return reject(err);
        } catch (e) {
          return reject(e);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Smoke test: /api/events (requires dev server at ' + BASE + ')');

  try {
    // 1) Create a date-only event
    const dateOnly = {
      title: 'Smoke: Date-only event',
      date: new Date().toISOString().slice(0, 10), // today
      description: 'Smoke test event (date-only)'
    };
    const created1 = await request('/api/events', 'POST', dateOnly);
    console.log('Created date-only event:', created1 && created1.id ? created1.id : created1);

    // 2) Create a timed event at least 2 minutes in the future to avoid server min offset
    const now = new Date(Date.now() + 5 * 60 * 1000); // +5 minutes
    const time = now.toTimeString().slice(0, 5); // HH:MM
    const dateStr = now.toISOString().slice(0, 10);
    const timed = {
      title: 'Smoke: Timed event',
      date: dateStr,
      time,
      description: 'Smoke test event (timed)'
    };
    const created2 = await request('/api/events', 'POST', timed);
    console.log('Created timed event:', created2 && created2.id ? created2.id : created2);

    // 3) Fetch events
    const all = await request('/api/events');
    console.log('Fetched events count:', Array.isArray(all) ? all.length : 'unexpected');

    // 4) Update the date-only event's title
    if (created1 && created1.id) {
      const patched = await request(`/api/events/${created1.id}`, 'PATCH', { title: 'Smoke: Updated title' });
      console.log('Patched event:', patched && patched.id ? patched.id : patched);

      // 5) Delete the date-only event
      try {
        const del = await request(`/api/events/${created1.id}`, 'DELETE');
        console.log('Deleted event:', del && del.id ? del.id : 'ok');
      } catch (e) {
        console.warn('Delete failed (may be archived instead):', e.message || e);
      }
    }

    // 6) Cleanup: delete or archive the timed event
    if (created2 && created2.id) {
      try {
        const del2 = await request(`/api/events/${created2.id}`, 'DELETE');
        console.log('Deleted timed event:', del2 && del2.id ? del2.id : 'ok');
      } catch (e) {
        console.warn('Timed event delete failed (may be archived):', e.message || e);
      }
    }

    console.log('Smoke test completed successfully.');
  } catch (err) {
    console.error('Smoke test failed:', err && err.message ? err.message : err);
    process.exitCode = 2;
  }
}

run();
