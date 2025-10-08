const prisma = require('../../../../lib/prisma');

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const updated = await prisma.event.update({ where: { id }, data: { completed: !event.completed } });
    return res.status(200).json({ success: true, event: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to toggle event' });
  }
}
