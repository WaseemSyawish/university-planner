import bcrypt from 'bcryptjs';
const prisma = require('../../../lib/prisma');

export default async function handler(req, res) {
  // Only allow this legacy helper in development to avoid demo authentication in production
  if (process.env.NODE_ENV !== 'development') {
    res.status(404).send('Not found');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  try {
    const { email, password, returnTo } = req.body || {};
    if (!email || !password) {
      res.status(400).send('Email and password required');
      return;
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password_hash) {
      res.status(401).send('Invalid credentials');
      return;
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).send('Invalid credentials');
      return;
    }

  // Set a simple HttpOnly cookie that our middleware accepts. In production you should
  // prefer secure, signed cookies and use proper session management.
    const maxAge = 60 * 60 * 24 * 30; // 30 days
  const cookie = `userId=${encodeURIComponent(user.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  // In dev, also set a non-HttpOnly readable cookie so client-side JS / logs can verify the cookie landed.
  const debugCookie = `debug_userId=${encodeURIComponent(user.id)}; Path=/; SameSite=Lax; Max-Age=${60}`; // short-lived debug cookie
  // Set both cookies
  res.setHeader('Set-Cookie', [cookie, debugCookie]);
  // Dev logging to help trace whether the cookie was generated
  try { if (process.env.NODE_ENV !== 'production') console.log('[local-signin] set-cookies:', { cookie, debugCookie }, 'for user', user.email || user.id); } catch (e) {}
  const dest = returnTo || '/overview';
    res.writeHead(302, { Location: dest });
    res.end();
    return;
  } catch (err) {
    console.error('local-signin error', err);
    res.status(500).send('Server error');
    return;
  }
}
