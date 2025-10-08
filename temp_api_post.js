const http = require('http');
const data = JSON.stringify({ title: 'test event', date: '2099-01-01', time: '09:30', durationMinutes: 45, description: 'smoke' });
const opts = { hostname: 'localhost', port: 3000, path: '/api/events', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
const req = http.request(opts, res => {
  console.log('status', res.statusCode);
  let body = '';
  res.on('data', c => body += c.toString());
  res.on('end', () => {
    console.log('len', body.length);
    console.log(body);
  });
});
req.on('error', e => console.error('ERR', e.message));
req.write(data);
req.end();
