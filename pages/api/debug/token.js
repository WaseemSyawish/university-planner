import jwt from 'jsonwebtoken';

export default function handler(req, res) {
  try {
    const raw = req.headers.cookie || '';
    const pairs = raw.split(';').map(s => s.trim()).filter(Boolean);
    const cookies = {};
    for (const p of pairs) {
      const idx = p.indexOf('=');
      if (idx > -1) cookies[p.slice(0, idx)] = decodeURIComponent(p.slice(idx+1));
    }

    const sessionToken = cookies['next-auth.session-token'] || cookies['__Secure-next-auth.session-token'] || null;
    let verified = null;
    if (sessionToken) {
      try {
        const secret = process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret';
        verified = jwt.verify(decodeURIComponent(sessionToken), secret);
      } catch (e) {
        verified = { error: String(e) };
      }
    }

    return res.status(200).json({ ok: true, cookies, sessionTokenPresent: !!sessionToken, sessionTokenPayload: verified });
  } catch (err) {
    console.error('debug/token error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
