// scripts/smoke_settings.js
// Signs a dev JWT with NEXTAUTH secret fallback and calls /api/users/settings
require('dotenv').config();
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

(async () => {
  try {
    const base = process.env.BASE_URL || 'http://localhost:3001';
    const secret = process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret';
    const userId = process.env.TEST_USER_ID || 'aef344d3-e602-402d-85de-055ba3c4629b';

    const token = jwt.sign({ userId }, secret, { expiresIn: '1h' });
    console.log('Using token for userId:', userId);

    console.log('\nGET /api/users/settings');
    let res = await fetch(base + '/api/users/settings', { headers: { Authorization: 'Bearer ' + token } });
    console.log('Status:', res.status);
    const getText = await res.text();
    console.log('Body:', getText);

    console.log('\nPATCH /api/users/settings');
    const newSettings = { theme: 'dark', language: 'es', timezone: 'auto' };
    res = await fetch(base + '/api/users/settings', { method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(newSettings) });
    console.log('Status:', res.status);
    const patchText = await res.text();
    console.log('Body:', patchText);

    console.log('\nGET again to confirm');
    res = await fetch(base + '/api/users/settings', { headers: { Authorization: 'Bearer ' + token } });
    console.log('Status:', res.status);
    console.log('Body:', await res.text());

  } catch (err) {
    console.error('Smoke test error', err);
    process.exit(1);
  }
})();
