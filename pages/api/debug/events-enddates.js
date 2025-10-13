const prisma = require('../../../../lib/prisma');

function localDateOnlyString(d) {
  if (!d) return null;
  const dt = (Object.prototype.toString.call(d) === '[object Date]') ? d : new Date(String(d));
  if (isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function handler(req, res) {
  // Protected debug endpoint — only enabled when DEBUG_EVENTS_SECRET env var is set.
  try {
    const secret = process.env.DEBUG_EVENTS_SECRET;
    if (!secret) return res.status(404).json({ error: 'Not available' });
    if (!req.query || req.query.secret !== secret) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(200, Number(req.query.limit) || 50);
    const events = await prisma.event.findMany({ orderBy: { created_at: 'desc' }, take: limit, select: { id: true, title: true, date: true, time: true, end_date: true, meta: true, template_id: true, created_at: true } });

    const out = events.map(ev => ({
      id: ev.id,
      title: ev.title,
      date: ev.date ? localDateOnlyString(ev.date) : null,
      time: ev.time || null,
      end_date: ev.end_date ? (ev.end_date instanceof Date ? ev.end_date.toISOString() : String(ev.end_date)) : null,
      meta: ev.meta || null,
      template_id: ev.template_id || null,
      created_at: ev.created_at ? (ev.created_at instanceof Date ? ev.created_at.toISOString() : String(ev.created_at)) : null
    }));

    return res.status(200).json({ events: out });
  } catch (err) {
    console.error('/api/debug/events-enddates error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
