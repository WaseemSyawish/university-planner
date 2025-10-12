const prisma = require('../../../lib/prisma');

async function getUserId(req) {
  const { getToken } = await import('next-auth/jwt');
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
  const tokenUserId = token && token.userId ? token.userId : null;
  if (tokenUserId) return tokenUserId;
  if (process.env.NODE_ENV === 'development' && req.query && req.query.userId) return String(req.query.userId);
  return null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Allow', 'GET,POST,OPTIONS'); return res.status(204).end(); }

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Graceful fallback if EventTemplate model isn't present in Prisma schema.
  if (typeof prisma.eventTemplate === 'undefined' || prisma.eventTemplate === null) {
    return res.status(200).json({ templates: [] });
  }

  if (req.method === 'GET') {
    try {
      const tpls = await prisma.eventTemplate.findMany({ where: { user_id: userId }, include: { events: true }, orderBy: { created_at: 'desc' } });
      return res.status(200).json({ templates: tpls });
    } catch (e) { console.error(e); return res.status(500).json({ error: 'Failed to fetch templates' }); }
  }

  if (req.method === 'POST') {
    try {
      const { title, courseId, startDate, payload } = req.body || {};
      const data = {
        title: title || 'Untitled timetable',
        course_id: courseId || null,
        start_date: startDate ? new Date(String(startDate)) : null,
        payload: payload || null,
        user_id: userId
      };
      const tpl = await prisma.eventTemplate.create({ data });
      return res.status(201).json({ template: tpl });
    } catch (e) { console.error(e); return res.status(500).json({ error: 'Failed to create template' }); }
  }

  res.setHeader('Allow', 'GET,POST,OPTIONS');
  res.status(405).end();
}
