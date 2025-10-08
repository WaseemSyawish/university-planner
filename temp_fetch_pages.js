const http = require('http');

// Try both localhost and 127.0.0.1 in case Next is bound differently
const urls = [
  'http://localhost:3001/grades',
  'http://127.0.0.1:3001/grades',
  'http://172.16.0.2:3001/grades',
  'http://localhost:3001/attendance',
  'http://127.0.0.1:3001/attendance',
  'http://172.16.0.2:3001/attendance'
];

const fetchUrl = (u) => new Promise((resolve) => {
  const req = http.get(u, (res) => {
    const status = res.statusCode;
    let body = '';
    res.on('data', (c) => body += c.toString());
    res.on('end', () => resolve({ url: u, status, len: body.length, snippet: body.slice(0, 800) }));
  });
  req.on('error', (e) => resolve({ url: u, error: e.message }));
  // safety timeout
  req.setTimeout(2000, () => {
    req.abort();
    resolve({ url: u, error: 'timeout' });
  });
});

(async () => {
  for (const u of urls) {
    const r = await fetchUrl(u);
    console.log('---', u, '---');
    if (r.error) console.log('ERR', r.error);
    else console.log('status', r.status, 'len', r.len, '\n', r.snippet);
  }
})();
