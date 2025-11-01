const prisma = require('../lib/prisma');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/debug-apply-series.js <templateId-or-mainId> [newTitle]');
    process.exit(2);
  }
  const tpl = args[0];
  const newTitle = args[1] || `DEBUG-PATCH-${Date.now()}`;

  console.log('Template/main id:', tpl);
  console.log('New title:', newTitle);

  // Count matching active events
  const activeCountBefore = await prisma.event.count({ where: { template_id: String(tpl) } });
  const archivedCountBefore = await prisma.archivedEvent.count({ where: { template_id: String(tpl) } }).catch(() => 0);
  console.log('Before: active=', activeCountBefore, 'archived=', archivedCountBefore);

  // Try updateMany for active
  try {
    const res = await prisma.event.updateMany({ where: { template_id: String(tpl) }, data: { title: newTitle } });
    console.log('updateMany result for active:', res);
  } catch (e) {
    console.error('updateMany active failed:', e && e.message ? e.message : e);
  }

  // Try updateMany for archived
  try {
    const res2 = await prisma.archivedEvent.updateMany({ where: { template_id: String(tpl) }, data: { title: newTitle } });
    console.log('updateMany result for archived:', res2);
  } catch (e) {
    console.error('updateMany archived failed:', e && e.message ? e.message : e);
  }

  const activeAfter = await prisma.event.findMany({ where: { template_id: String(tpl) }, select: { id: true, title: true, date: true } });
  const archivedAfter = await prisma.archivedEvent.findMany({ where: { template_id: String(tpl) }, select: { id: true, title: true, date: true } }).catch(() => []);

  console.log('After active count:', activeAfter.length);
  console.log('After archived count:', archivedAfter.length);
  console.log('Sample active ids/titles:', activeAfter.slice(0,10));

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
