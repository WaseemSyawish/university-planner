const prisma = require('../../../../lib/prisma');

function isDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function localDateOnlyString(d) {
  if (!d) return null;
  const dt = (Object.prototype.toString.call(d) === '[object Date]') ? d : new Date(String(d));
  if (isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateForStorage(value) {
  if (!value) return new Date();
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  const s = String(value);
  if (isDateOnly(s)) return new Date(s + 'T00:00:00');
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res.status(405).end();
  }

  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing template id' });

    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret' });
    const tokenUserId = token && token.userId ? token.userId : null;
    if (!tokenUserId) return res.status(401).json({ error: 'Unauthorized' });

    const tpl = await prisma.eventTemplate.findUnique({ where: { id: String(id) } });
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    if (tpl.user_id !== tokenUserId) return res.status(403).json({ error: 'Forbidden' });

    const payload = tpl.payload;
    if (!payload || !Array.isArray(payload)) {
      return res.status(400).json({ error: 'Template payload missing or invalid (expected array of modules)' });
    }

    // Create events from payload items. Each item can include: title, courseId, date (YYYY-MM-DD or ISO), time, description, durationMinutes
    const created = await prisma.$transaction(async (tx) => {
      const createdEvents = [];
      for (const item of payload) {
        const itemDate = item.date ? parseDateForStorage(item.date) : tpl.start_date ? new Date(tpl.start_date) : new Date();
        const evData = {
          title: item.title || tpl.title || '',
          type: item.type || 'assignment',
          course_id: item.courseId || tpl.course_id || null,
          date: itemDate,
          time: item.time || null,
          description: item.description || null,
          user_id: tokenUserId,
          template_id: tpl.id
        };
        const ev = await tx.event.create({ data: evData });
        createdEvents.push(ev);
      }
      return createdEvents;
    });

    const normalized = created.map(ev => ({ ...ev, date: localDateOnlyString(ev.date) }));
    return res.status(201).json({ events: normalized });
  } catch (err) {
    console.error('POST /api/event-templates/[id]/materialize error', err);
    return res.status(500).json({ error: 'Failed to materialize template' });
  }
}
