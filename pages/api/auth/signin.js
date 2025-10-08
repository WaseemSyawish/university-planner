const prisma = require('../../../lib/prisma');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

function setSessionCookie(res, payload) {
  const maxAge = 60 * 60 * 24 * 7; // 7 days in seconds
  const secret = process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret';
  const token = jwt.sign(payload, secret, { expiresIn: maxAge });
  // Use a single cookie name 'session' for simplicity
  const secureFlag = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  // HttpOnly, Path=/, SameSite=Lax and Max-Age (in seconds)
  res.setHeader(
    'Set-Cookie',
    `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; ${secureFlag}`
  );
}

function loadLocalDevUser() {
  // Try environment first
  if (process.env.DEV_USER_EMAIL) {
    return {
      id: process.env.DEV_USER_ID || 'dev-user',
      email: process.env.DEV_USER_EMAIL,
      name: process.env.DEV_USER_NAME || 'Developer'
    };
  }
  // Next try data/dev-user.json
  try {
    const p = path.join(process.cwd(), 'data', 'dev-user.json');
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email) return parsed;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body || {};

  // Try to query DB but handle unreachable DB with a clear 503 and a local dev-user fallback
  try {
    let user = null;
    if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    }
    if (!user) {
      // fallback to first user in database (dev/demo behavior)
      user = await prisma.user.findFirst();
    }
    if (!user) {
      // No user in DB — try local dev-user fallback
      const local = loadLocalDevUser();
      if (local) {
        setSessionCookie(res, { userId: local.id, email: local.email, name: local.name });
        return res.status(200).json({ success: true, id: local.id, name: local.name, email: local.email, warning: 'Using local dev-user fallback' });
      }
      return res.status(400).json({ error: 'No user available' });
    }

    setSessionCookie(res, { userId: user.id, email: user.email, name: user.name });
    return res.status(200).json({ success: true, id: user.id, name: user.name, email: user.email });
  } catch (err) {
    // Detect common Prisma connection error message and return 503 with helpful details
    const msg = err && err.message ? String(err.message) : '';
    console.error('POST /api/auth/signin error', msg || err);
    if (msg.includes("Can't reach database server") || msg.includes('P1001') || msg.includes('Connection refused') || msg.includes('connect ECONNREFUSED')) {
      // DB unreachable — return 503 and try local dev-user fallback
      const local = loadLocalDevUser();
      if (local) {
        setSessionCookie(res, { userId: local.id, email: local.email, name: local.name });
        return res.status(200).json({ success: true, id: local.id, name: local.name, email: local.email, warning: 'Database unreachable — using local dev-user fallback' });
      }
      return res.status(503).json({ error: 'Database unreachable', details: msg });
    }
    return res.status(500).json({ error: 'Failed to sign in', details: msg });
  }
}
