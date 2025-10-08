// pages/api/timetable/[id].js
import prisma from '../../../lib/prisma';

// Resolve user id helper (next-auth token or development query fallback)
async function resolveUserId(req) {
  try {
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
    if (token && token.userId) return String(token.userId);
  } catch (e) { /* ignore */ }
  if (process.env.NODE_ENV === 'development' && req.query && req.query.userId) return String(req.query.userId);
  return null;
}

export default async function handler(req, res) {
  const { id } = req.query;
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const tpl = await prisma.eventTemplate.findUnique({ where: { id } });
      if (!tpl || tpl.user_id !== userId) return res.status(404).json({ error: 'Template not found' });
      return res.status(200).json({ id: tpl.id, title: tpl.title, payload: tpl.payload, courseId: tpl.course_id, repeatOption: tpl.repeat_option, startDate: tpl.start_date ? tpl.start_date.toISOString().slice(0,10) : null });
    }

    if (req.method === 'PUT') {
      const { title, payload, courseId, repeatOption, startDate } = req.body;
      const tpl = await prisma.eventTemplate.findUnique({ where: { id } });
      if (!tpl || tpl.user_id !== userId) return res.status(404).json({ error: 'Template not found' });
      const data = {
        title: typeof title !== 'undefined' ? title : tpl.title,
        payload: typeof payload !== 'undefined' ? payload : tpl.payload,
        course_id: typeof courseId !== 'undefined' ? courseId : tpl.course_id,
        repeat_option: typeof repeatOption !== 'undefined' ? repeatOption : tpl.repeat_option,
        start_date: typeof startDate !== 'undefined' && startDate ? new Date(String(startDate)) : tpl.start_date
      };
      const updated = await prisma.eventTemplate.update({ where: { id }, data });
      return res.status(200).json({ id: updated.id, title: updated.title, payload: updated.payload });
    }

    if (req.method === 'DELETE') {
      const tpl = await prisma.eventTemplate.findUnique({ where: { id } });
      if (!tpl || tpl.user_id !== userId) return res.status(404).json({ error: 'Template not found' });
      await prisma.eventTemplate.delete({ where: { id } });
      return res.status(200).json({ message: 'Template deleted' });
    }

    res.setHeader('Allow', ['GET','PUT','DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    console.error('Prisma /api/timetable/[id] error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}