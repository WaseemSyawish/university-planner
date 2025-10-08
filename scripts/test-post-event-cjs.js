// Simple CommonJS test runner that calls the compiled Next API route handler in .next/server/pages/api/events.js
// It constructs minimal req/res/ctx objects and prints the response.

const path = require('path');
const fs = require('fs');

const compiledHandlerPath = path.join(__dirname, '..', '.next', 'server', 'pages', 'api', 'events.js');
let mod;
if (fs.existsSync(compiledHandlerPath)) {
  mod = require(compiledHandlerPath);
} else {
  // Fall back to source API handler so we don't need a production build
  const srcHandlerPath = path.join(__dirname, '..', 'pages', 'api', 'events.js');
  if (!fs.existsSync(srcHandlerPath)) {
    console.error('Neither compiled nor source handler found. Looked for', compiledHandlerPath, 'and', srcHandlerPath);
    process.exit(2);
  }
  mod = require(srcHandlerPath);
}
const handler = mod.default || mod.handler || mod;

// Minimal mock request/response
const req = {
  method: 'POST',
  url: '/api/events',
  headers: {
    'content-type': 'application/json'
  },
  query: {},
  body: {
    title: 'Scripted Test Event',
    type: 'assignment',
    date: '2025-01-01',
    time: '12:00',
    description: 'Created by test-post-event-cjs.js',
    userId: 'aef344d3-e602-402d-85de-055ba3c4629b'
  }
};

let statusCode = 200;
const res = {
  status(code) { statusCode = code; return this; },
  setHeader() {},
  json(payload) {
    console.log('RES STATUS', statusCode);
    console.log('RES JSON', JSON.stringify(payload, null, 2));
    process.exit(0);
  },
  end(msg) { console.log('end', msg); process.exit(0); }
};

const ctx = { waitUntil: (p) => p && p.then ? p.catch(()=>{}) : null };

(async () => {
  try {
    await handler(req, res, ctx);
  } catch (err) {
    console.error('Handler threw:', err);
    process.exit(1);
  }
})();
