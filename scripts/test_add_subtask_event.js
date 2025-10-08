// scripts/test_add_subtask_event.js
// Test that invokes the events API handler directly with a mocked request/response.
// Uses dynamic import via file:// URL so it works with ESM-style exports in the API module.

const path = require('path');
const { pathToFileURL } = require('url');

function makeMockReq(method, body) {
  return {
    method,
    query: {},
    body,
  };
}

function makeMockRes() {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res._json = payload; return payload; };
  res.setHeader = () => {};
  return res;
}

(async function run() {
  const modulePath = pathToFileURL(path.resolve(__dirname, '../pages/api/events.js')).href;
  try {
    const mod = await import(modulePath);
    const handler = mod.default;

    const subtaskPayload = {
      title: 'Test event with subtasks',
      type: 'assignment',
      courseId: null,
      date: new Date().toISOString().split('T')[0], // date-only
      time: '',
      description: JSON.stringify({ text: 'Has subtasks', subtasks: [{ id: 's1', text: 'Step 1', done: false }, { id: 's2', text: 'Step 2', done: true }] }),
      userId: 'test-user-1'
    };

    const req = makeMockReq('POST', subtaskPayload);
    const res = makeMockRes();

    await handler(req, res);
    console.log('Status:', res.statusCode);
    console.log('Body:', JSON.stringify(res._json, null, 2));
  } catch (err) {
    console.error('Test failed:', err);
  }
})();
