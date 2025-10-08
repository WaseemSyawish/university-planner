const http = require('http');

http.get('http://localhost:3001/api/events', (res) => {
  console.log('status', res.statusCode);
  let body = '';
  res.on('data', (c) => body += c.toString());
  res.on('end', () => {
    console.log('len', body.length);
    console.log(body.slice(0,1000));
  });
}).on('error', (e) => console.error('ERR', e.message));
