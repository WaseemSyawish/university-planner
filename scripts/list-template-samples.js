const prisma = require('../lib/prisma');

async function main() {
  const samples = await prisma.event.findMany({ where: { template_id: { not: null } }, take: 20, select: { id: true, template_id: true, title: true, date: true } });
  console.log('Sample events with template_id:', samples.length);
  console.log(samples.map(s => ({ id: s.id, tpl: s.template_id, title: s.title, date: s.date }))); 

  // Also show counts grouped by template_id for top few
  const raw = await prisma.$queryRaw`SELECT template_id, count(*) as cnt FROM "Event" WHERE template_id IS NOT NULL GROUP BY template_id ORDER BY cnt DESC LIMIT 10;`;
  console.log('Top template_id groups (approx):', raw);
}

main().catch(err => { console.error(err); process.exit(1); });
