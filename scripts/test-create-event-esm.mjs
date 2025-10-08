import handler from '../pages/api/events.js';

async function run() {
  const req = {
    method: 'POST',
    body: {
      title: 'Test Event from script',
      type: 'assignment',
      courseId: null,
      date: new Date().toISOString().split('T')[0],
      time: '',
      description: 'created by test script',
      userId: 'aef344d3-e602-402d-85de-055ba3c4629b'
    }
  };
  const res = {
    statusCode: 200,
    headers: {},
    _body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this._body = obj; console.log('RESPONSE:', JSON.stringify(obj, null, 2)); return this; },
    setHeader(k, v) { this.headers[k] = v; }
  };

  try {
    await handler(req, res);
  } catch (err) {
    console.error('Handler threw:', err);
  }
}

run();
