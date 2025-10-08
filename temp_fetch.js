const http = require('http');

http.get('http://localhost:3001/timetable', (res) => {
  console.log('status', res.statusCode);
  let body = '';
  res.on('data', (c) => body += c.toString());
  res.on('end', () => {
    console.log('len', body.length);
    const snippet = body.slice(0, 2000);
    console.log('---BEGIN SNIPPET---');
    console.log(snippet);
    console.log('---END SNIPPET---');
    // quick check for modal markers
    console.log('contains type="time"?', snippet.includes('type="time"'));
    console.log('contains durationMinutes?', snippet.includes('durationMinutes'));
  });
}).on('error', (e) => console.error('ERR', e.message));
