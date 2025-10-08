import handler from '../pages/api/attendance.js';

async function run() {
  const req = { method: 'GET', query: { courseId: '1758304750065', userId: 'aef344d3-e602-402d-85de-055ba3c4629b' } };
  const res = {
    statusCode: 200,
    headers: {},
    _body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this._body = obj; console.log('RESPONSE:', JSON.stringify(obj, null, 2)); return this; },
    setHeader(k, v) { this.headers[k] = v; }
  };

  await handler(req, res);
}

run();
