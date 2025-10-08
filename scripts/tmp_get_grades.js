const http = require('http');
const url = 'http://localhost:3001/api/grades';
http.get(url, res => {
  console.log('status', res.statusCode);
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try { console.log(JSON.parse(d)); }
    catch (e) { console.log(d); }
  });
}).on('error', e => { console.error('ERR', e.message); process.exit(2); });
