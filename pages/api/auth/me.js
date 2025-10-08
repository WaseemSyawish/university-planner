import { getToken } from 'next-auth/jwt';
const prisma = require('../../../lib/prisma');

// Returns 200 + user when authenticated, otherwise 401
export default async function handler(req, res) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
    if (!token || !token.userId) {
      return res.status(401).json({ authenticated: false, error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({ where: { id: token.userId } });
    if (!user) return res.status(404).json({ authenticated: false, error: 'User not found' });

    return res.status(200).json({ authenticated: true, id: user.id, name: user.name, email: user.email });
  } catch (err) {
    console.error('/api/auth/me error', err);
    return res.status(500).json({ error: 'Failed to read auth' });
  }
}
