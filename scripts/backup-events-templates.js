const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma');

async function main() {
  const outDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  console.log('[backup] fetching EventTemplate and Event rows from DB...');
  const templates = await prisma.eventTemplate.findMany({ include: { events: true } });
  const events = await prisma.event.findMany();

  const tplPath = path.join(outDir, `backup-event-templates-${ts}.json`);
  const evPath = path.join(outDir, `backup-events-${ts}.json`);

  fs.writeFileSync(tplPath, JSON.stringify(templates, null, 2), 'utf8');
  fs.writeFileSync(evPath, JSON.stringify(events, null, 2), 'utf8');

  console.log(`[backup] templates exported -> ${tplPath}`);
  console.log(`[backup] events exported -> ${evPath}`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
