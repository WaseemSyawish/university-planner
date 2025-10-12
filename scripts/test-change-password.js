require('dotenv').config();
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

(async () => {
  try {
    const base = process.env.BASE_URL || 'http://localhost:3001';
    const secret = process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret';
    const userId = process.env.TEST_USER_ID || '566c6ce8-11d0-44c8-9a3e-bb8e1f63140e';
    const token = jwt.sign({ userId }, secret, { expiresIn: '1h' });
    console.log('Using token for userId:', userId);

  const res = await fetch(base + '/api/users/change-password?devUserId=' + encodeURIComponent(userId), { method: 'POST', headers: { /* Authorization: 'Bearer ' + token, */ 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: 'Ooppllmm1', newPassword: 'NewPassw0rd!' }) });
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
  } catch (err) {
    console.error('Error', err);
    process.exit(1);
  }
})();
