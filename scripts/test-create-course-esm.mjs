import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const apiPath = pathToFileURL(path.resolve('./pages/api/courses.js')).href;

async function run() {
  try {
    const mod = await import(apiPath);
    const handler = mod.default;

    const req = {
      method: 'POST',
      body: {
        name: 'ESM Script Course',
        code: 'ESM100',
        credits: 3,
        color: '#3B82F6',
        semester: '2025-1',
        instructor: 'ESM Tester',
        description: 'created by esm script',
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

    await handler(req, res);
  } catch (err) {
    console.error('ESM script error:', err);
  }
}

run();
