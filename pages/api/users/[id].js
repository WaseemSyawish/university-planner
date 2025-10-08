import prisma from '../../../lib/prisma';

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map(s => { const [k,v] = s.split('='); return [k && k.trim(), v && v.trim()]; }).filter(Boolean));
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });
  try {
    if (req.method === 'GET') {
      // require token-based auth: only allow access if token.userId === id or admin
      const { getToken } = await import('next-auth/jwt');
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
      const tokenUserId = token && token.userId ? token.userId : null;
      if (!tokenUserId) return res.status(401).json({ error: 'Unauthorized' });
      if (tokenUserId !== id) return res.status(403).json({ error: 'Forbidden' });
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({ id: user.id, name: user.name || 'User', email: user.email || '', avatarColor: user.color || '#60A5FA' });
    }

    if (req.method === 'PATCH') {
      // token-based auth: only allow updating your own profile
      const { getToken } = await import('next-auth/jwt');
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
      const tokenUserId = token && token.userId ? token.userId : null;
      if (!tokenUserId) return res.status(401).json({ error: 'Unauthorized' });
      if (tokenUserId !== id) return res.status(403).json({ error: 'Forbidden' });
      const { name, email, avatarColor } = req.body || {};
      const data = {};
      if (typeof name === 'string') data.name = name;
      if (typeof email === 'string') data.email = email;
      if (typeof avatarColor === 'string') data.color = avatarColor;
      const updated = await prisma.user.update({ where: { id }, data });
      return res.json({ success: true, user: { id: updated.id, name: updated.name, email: updated.email, avatarColor: updated.color } });
    }

    res.setHeader('Allow', 'GET,PATCH');
    return res.status(405).end();
  } catch (err) {
    console.error('[api/users/[id]]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
