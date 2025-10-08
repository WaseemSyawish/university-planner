import { getToken } from 'next-auth/jwt';
const prisma = require('../../../lib/prisma');

export default async function handler(req, res) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
    if (!token || !token.userId) return res.status(401).json({ error: 'Not authenticated' });

    const userId = token.userId;

    if (req.method === 'GET') {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
      return res.status(200).json({ settings: user?.settings ?? null });
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
      const body = req.body || {};
      // accept any JSON blob for settings
      const updated = await prisma.user.update({ where: { id: userId }, data: { settings: body } });
      return res.status(200).json({ settings: updated.settings });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/users/settings error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
