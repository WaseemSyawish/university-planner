function makeMockReq(body) {
  return { method: 'POST', body };
}

function makeMockRes() {
  const headers = {};
  return {
    headers,
    setHeader(k, v) { headers[k] = v; },
    status(code) { this._status = code; return this; },
    json(obj) { console.log('RES JSON', this._status, obj); return obj; },
    end() { console.log('end', this._status); }
  };
}

(async () => {
  try {
    const mod = await import('../pages/api/auth/signin.js');
    const handler = mod.default;
    const req = makeMockReq({ email: 'no-such-email@example.com' });
    const res = makeMockRes();
    await handler(req, res);
  } catch (e) {
    console.error('handler threw', e && e.message);
  }
})();
