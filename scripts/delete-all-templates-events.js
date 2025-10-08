const prisma = require('../lib/prisma');
const args = process.argv.slice(2);

const confirm = args.includes('--confirm');

async function main() {
  console.log('[delete-all] Fetching counts...');
  const tplCount = await prisma.eventTemplate.count();
  const evCount = await prisma.event.count();
  console.log(`[delete-all] templates=${tplCount} events=${evCount}`);

  if (!tplCount && !evCount) {
    console.log('[delete-all] nothing to do');
    return;
  }

  console.log('[delete-all] WARNING: this will remove ALL Event and EventTemplate rows from DB');
  if (!confirm) {
    console.log('[delete-all] dry-run (no changes). Re-run with --confirm to actually delete.');
    return;
  }

  console.log('[delete-all] confirmed — deleting all events then templates in a transaction...');
  await prisma.$transaction(async (tx) => {
    await tx.event.deleteMany({});
    await tx.eventTemplate.deleteMany({});
  });

  const tplAfter = await prisma.eventTemplate.count();
  const evAfter = await prisma.event.count();
  console.log(`[delete-all] complete. now templates=${tplAfter} events=${evAfter}`);
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
