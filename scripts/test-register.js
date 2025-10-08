const fetch = require('node-fetch');
(async ()=>{
  try {
  const res = await fetch('http://127.0.0.1:3000/api/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Script', email: 'smoke.script@example.com', password: 'testpass123' })
    });
    console.log('Status', res.status);
    const text = await res.text();
    console.log(text);
  } catch (err) {
    console.error('Err', err);
  }
})();
