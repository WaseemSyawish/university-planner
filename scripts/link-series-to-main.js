#!/usr/bin/env node
// scripts/link-series-to-main.js
// Usage: node scripts/link-series-to-main.js <mainEventId>
// This script sets the series' template_id to the main event's id and
// updates all child events/archived events that reference the existing
// template_id to use the main event id instead. This makes the series
// linkage stable and tied to the main event id.

const prisma = require('../lib/prisma');

async function linkSeries(mainId) {
  const main = await prisma.event.findUnique({ where: { id: mainId } });
  if (!main) {
    console.error('Main event not found for id', mainId);
    process.exitCode = 2;
    return;
  }

  const currentTpl = main.template_id || null;
  if (!currentTpl) {
    // If there is no template_id, set it to the main id and done
    await prisma.event.update({ where: { id: mainId }, data: { template_id: mainId } });
    console.log('Set main event.template_id = main id (', mainId, ')');
    return;
  }

  if (String(currentTpl) === String(mainId)) {
    console.log('Series already linked to main id; nothing to do.');
    return;
  }

  // Update main event to use its own id as template_id
  await prisma.event.update({ where: { id: mainId }, data: { template_id: mainId } });
  console.log('Updated main event.template_id ->', mainId, '(was', currentTpl, ')');

  // Update all child active events that used the old template id
  const updatedActive = await prisma.event.updateMany({ where: { template_id: String(currentTpl) }, data: { template_id: mainId } });
  console.log('Updated active events count:', updatedActive.count);

  // Update archived events as well
  try {
    const updatedArchived = await prisma.archivedEvent.updateMany({ where: { template_id: String(currentTpl) }, data: { template_id: mainId } });
    console.log('Updated archived events count:', updatedArchived.count);
  } catch (e) {
    console.warn('archivedEvent updateMany failed (maybe archived model differs); error:', e && e.message ? e.message : e);
  }

  console.log('Linking complete. All occurrences now use template_id = main event id.');
}

const args = process.argv.slice(2);
if (!args[0]) {
  console.error('Usage: node scripts/link-series-to-main.js <mainEventId>');
  process.exit(1);
}

(async () => {
  try {
    await linkSeries(args[0]);
  } catch (e) {
    console.error('Failed to link series:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
