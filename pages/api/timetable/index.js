import prisma from '../../../lib/prisma';

// Helper: resolve user id from next-auth token, fallback to query.userId in development
async function resolveUserId(req) {
  try {
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
    if (token && token.userId) return String(token.userId);
  } catch (e) {
    // ignore
  }
  if (process.env.NODE_ENV === 'development' && req.query && req.query.userId) return String(req.query.userId);
  return null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET,POST,OPTIONS');
    return res.status(204).end();
  }

  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      // Return all templates for the user. Map payload to a friendly shape the client expects.
      const templates = await prisma.eventTemplate.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' } });
      const out = templates.map(t => {
        const payload = t.payload || null;
        // If payload is an array of module definitions, keep as-is; otherwise try to map
        // for backward compatibility with earlier client expectations (dayOfWeek/time/duration)
        return {
          id: t.id,
          title: t.title,
          courseId: t.course_id || null,
          repeatOption: t.repeat_option || null,
          startDate: t.start_date ? t.start_date.toISOString().slice(0,10) : null,
          payload,
          // Convenience mapping: if payload is an array and first item looks like a module, expose some fields
          ...(Array.isArray(payload) && payload.length > 0 && typeof payload[0] === 'object' ? { modules: payload } : {})
        };
      });
      return res.status(200).json(out);
    }

    if (req.method === 'POST') {
      // Create a new EventTemplate for the user
      const { title, courseId, repeatOption, startDate, payload } = req.body;
      if (!title && !payload) return res.status(400).json({ error: 'Missing title or payload' });
      const data = {
        title: title || (Array.isArray(payload) && payload[0] && payload[0].subject ? payload[0].subject : 'Timetable'),
        course_id: courseId || null,
        repeat_option: repeatOption || null,
        start_date: startDate ? new Date(String(startDate)) : null,
        payload: payload || null,
        user_id: userId
      };

      const tpl = await prisma.eventTemplate.create({ data });
      return res.status(201).json({ id: tpl.id, title: tpl.title, payload: tpl.payload });
    }

    res.setHeader('Allow', ['GET','POST','OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    console.error('Prisma /api/timetable error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
