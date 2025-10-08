const prisma = require('../lib/prisma');

async function main() {
  console.log('[find-suspect] looking for templates without payload or with zero events...');
  const templates = await prisma.eventTemplate.findMany({ include: { events: true } });
  const suspects = templates.filter(t => (!t.payload || (Array.isArray(t.payload) && t.payload.length === 0)) && (!t.events || t.events.length === 0));
  console.log(`[find-suspect] found ${suspects.length} templates that look empty`);
  for (const s of suspects) {
    console.log(' -', s.id, s.title, 'start_date:', s.start_date, 'events:', (s.events || []).length);
  }

  // find events that reference missing template_id
  console.log('[find-suspect] looking for events with non-existent template_id');
  const events = await prisma.event.findMany({ where: { NOT: { template_id: null } } });
  const orphans = [];
  for (const ev of events) {
    try {
      const tpl = await prisma.eventTemplate.findUnique({ where: { id: ev.template_id } });
      if (!tpl) orphans.push(ev);
    } catch (e) { /* ignore lookup error */ }
  }
  console.log(`[find-suspect] found ${orphans.length} events referencing missing templates`);
  for (const o of orphans) console.log(' -', o.id, 'template_id:', o.template_id, 'date:', o.date);
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
