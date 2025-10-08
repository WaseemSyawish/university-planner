const prisma = require('../../../lib/prisma');
const jwt = require('jsonwebtoken');

function setSessionCookie(res, payload) {
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const secret = process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret';
  const token = jwt.sign(payload, secret, { expiresIn: maxAge });
  // Use a single cookie name 'session' for simplicity
  const secureFlag = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  res.setHeader('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; ${secureFlag}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { email } = req.body || {};
    let user = null;
    if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    }
    if (!user) {
      // fallback to first user in database (dev/demo behavior)
      user = await prisma.user.findFirst();
    }
    if (!user) return res.status(400).json({ error: 'No user available' });
    setSessionCookie(res, { userId: user.id, email: user.email, name: user.name });
    return res.status(200).json({ success: true, id: user.id, name: user.name, email: user.email });
  } catch (err) {
    console.error('POST /api/auth/signin error', err);
    return res.status(500).json({ error: 'Failed to sign in' });
  }
}
