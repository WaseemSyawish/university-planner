// scripts/test-create-course.js
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const api = require('../pages/api/courses.js');
    // The module exports default handler; the helper functions are not exported, so we need to call the default handler
    // We'll create a mock req/res to call the handler. This approximates a Next API invocation.

    const req = {
      method: 'POST',
      body: {
        name: 'Script Course',
        code: 'SC100',
        credits: 3,
        color: '#3B82F6',
        semester: '2025-1',
        instructor: 'Script Tester',
        description: 'created by script',
        userId: 'aef344d3-e602-402d-85de-055ba3c4629b'
      },
      query: {}
    };

    const res = {
      statusCode: 200,
      headers: {},
      _body: null,
      status(code) { this.statusCode = code; return this; },
      json(obj) { this._body = obj; console.log('RESPONSE:', JSON.stringify(obj, null, 2)); return this; },
      setHeader(k, v) { this.headers[k] = v; }
    };

    await api.default(req, res);
  } catch (err) {
    console.error('Script error:', err);
  }
}

run();
