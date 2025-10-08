const fetch = require('node-fetch');

(async () => {
  try {
    console.log('Registering test user...');
    const reg = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Copilot Test', email: 'copilot-test@example.local', password: 'TestPass123!' })
    });
    console.log('register status', reg.status);
    const regText = await reg.text();
    console.log('register body:', regText);

    console.log('\nCalling debug before login...');
    const dbg1 = await fetch('http://localhost:3001/api/auth/debug');
    console.log('debug before status', dbg1.status);
    try { console.log('debug before json:', await dbg1.json()); } catch(e){ console.log('debug before raw:', await dbg1.text()); }

    console.log('\nPerforming credentials callback (login)...');
    const form = new URLSearchParams();
    form.append('csrfToken', '');
    form.append('callbackUrl', 'http://localhost:3001/overview');
    form.append('email', 'copilot-test@example.local');
    form.append('password', 'TestPass123!');

    const login = await fetch('http://localhost:3001/api/auth/callback/credentials', {
      method: 'POST',
      body: form,
      redirect: 'manual'
    });
    console.log('login status', login.status);
    const rawSetCookie = login.headers.raw()['set-cookie'] || [];
    console.log('Set-Cookie headers from callback:', rawSetCookie);

    const cookieHeader = rawSetCookie.length ? rawSetCookie.map(c => c.split(';')[0]).join('; ') : '';
    console.log('Cookie header to send:', cookieHeader || '(none)');

    console.log('\nCalling debug after login with cookies...');
    const dbg2 = await fetch('http://localhost:3001/api/auth/debug', {
      headers: cookieHeader ? { cookie: cookieHeader } : {}
    });
    console.log('debug after status', dbg2.status);
    try { console.log('debug after json:', await dbg2.json()); } catch(e){ console.log('debug after raw:', await dbg2.text()); }

    process.exit(0);
  } catch (err) {
    console.error('auth-debug failed', err);
    process.exit(2);
  }
})();
