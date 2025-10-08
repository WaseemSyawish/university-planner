const prisma = require('../lib/prisma');

async function main() {
  console.log('[list-candidates] scanning EventTemplate rows for empty payload + zero child events...');
  const templates = await prisma.eventTemplate.findMany({ include: { events: true } });
  const candidates = templates.filter(t => (
    (!t.payload || (Array.isArray(t.payload) && t.payload.length === 0)) &&
    (!t.events || t.events.length === 0)
  ));
  console.log('[list-candidates] count =', candidates.length);
  if (candidates.length) {
    console.log('[list-candidates] ids ->', candidates.map(t => t.id).join(','));
    console.log('[list-candidates] full ->');
    console.log(JSON.stringify(candidates.map(t => ({ id: t.id, title: t.title, start_date: t.start_date, created_at: t.created_at || null })), null, 2));
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
