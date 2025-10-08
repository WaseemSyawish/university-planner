const http = require('http');
const url = process.argv[2] || 'http://127.0.0.1:3000/grades';
http.get(url, res => {
  console.log('status', res.statusCode);
  console.log('content-type', res.headers['content-type']);
  let received = 0;
  res.on('data', chunk => { received += chunk.length; });
  res.on('end', () => { console.log('bytes', received); process.exit(0); });
}).on('error', e => {
  console.error('ERR', e);
  process.exit(2);
});
