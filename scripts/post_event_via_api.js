// posts a test event to local /api/events and prints the response
// Usage: node scripts/post_event_via_api.js

const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async function main() {
  const maxAttempts = 30;
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  let attempt = 0;
  let baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  const now = new Date();
  const start = new Date(now.getTime() + 1000 * 60 * 60); // +1h from now
  start.setMinutes(0,0,0);
  const end = new Date(start.getTime() + 1000 * 60 * 60 * 2); // +2h (duration 2 hours)

  // Ensure we send a valid userId in development so the API resolves the user
  let testUserId = null;
  try {
    const u = await prisma.user.findFirst();
    if (u) testUserId = u.id;
    else {
      const nu = await prisma.user.create({ data: { email: `dev+${Date.now()}@example.com`, name: 'Dev Test' } });
      testUserId = nu.id;
    }
  } catch (e) {
    console.warn('Prisma lookup for test user failed, continuing without userId:', e && e.message ? e.message : e);
  }

  const body = {
    title: `API test event ${Date.now()}`,
    date: `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`,
    time: `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    durationMinutes: Math.round((end - start) / 60000),
    type: 'personal'
  };

  if (testUserId) body.userId = testUserId;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const tryUrls = [baseUrl, baseUrl.replace(':3000', ':3001')];
      let res = null;
      let lastErr = null;
      for (const u of tryUrls) {
        try {
          res = await fetch(`${u}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!res) throw lastErr || new Error('No response');
      // Read body once then try to parse JSON for better error messages
      const txt = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(txt); } catch (e) { parsed = txt; }
      console.log('Status:', res.status);
      console.log('Body:', typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));
      process.exit(res.ok ? 0 : 1);
    } catch (e) {
      console.log(`Attempt ${attempt} failed: ${e.message}. Retrying in 1s...`);
      await delay(1000);
    }
  }
  console.error('Server did not respond after retries');
  process.exit(2);
})();
