// scripts/backfill-template-id.js
// Backfill script: reads meta/description [META] blocks and populates template_id
// Run on staging/backup first. Use Node and Prisma client.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseMetaFromDescription(desc) {
  try {
    const m = String(desc || '').match(/\[META\]([\s\S]*?)\[META\]/);
    if (!m) return null;
    return JSON.parse(m[1]);
  } catch (e) { return null; }
}

async function backfillEvents(batchSize = 500) {
  console.log('Starting backfill for events...');
  let skip = 0;
  while (true) {
    const rows = await prisma.event.findMany({ skip, take: batchSize, select: { id: true, description: true, meta: true, template_id: true } });
    if (!rows || rows.length === 0) break;
    for (const r of rows) {
      if (r.template_id) continue;
      let tpl = null;
      if (r.meta && typeof r.meta === 'object') {
        tpl = r.meta.template_id || r.meta.templateId || null;
      }
      if (!tpl && r.description) {
        const parsed = parseMetaFromDescription(r.description);
        if (parsed) tpl = parsed.template_id || parsed.templateId || null;
      }
      if (tpl) {
        try {
          await prisma.event.update({ where: { id: r.id }, data: { template_id: tpl } });
          console.log('Backfilled event', r.id, '->', tpl);
        } catch (e) {
          console.warn('Failed to update event', r.id, e && e.message);
        }
      }
    }
    skip += rows.length;
    console.log('Processed', skip);
  }
}

async function backfillArchived(batchSize = 500) {
  console.log('Starting backfill for archived events...');
  let skip = 0;
  while (true) {
    // Try to select the richer shape (with `meta`) but fall back if the model
    // doesn't expose that field in the Prisma schema (some deployments).
    let rows;
    try {
      rows = await prisma.archivedEvent.findMany({ skip, take: batchSize, select: { id: true, description: true, meta: true, template_id: true } });
    } catch (err) {
      // If `meta` isn't a known field on archivedEvent, fall back to a minimal select
      // and continue. Re-throw unexpected errors.
      const msg = String(err && err.message || '');
      if (msg.includes('Unknown field') || msg.includes('for select statement on model')) {
        rows = await prisma.archivedEvent.findMany({ skip, take: batchSize, select: { id: true, description: true, template_id: true } });
      } else {
        throw err;
      }
    }
    if (!rows || rows.length === 0) break;
    for (const r of rows) {
      if (r.template_id) continue;
      let tpl = null;
      if (r.meta && typeof r.meta === 'object') {
        tpl = r.meta.template_id || r.meta.templateId || null;
      }
      if (!tpl && r.description) {
        const parsed = parseMetaFromDescription(r.description);
        if (parsed) tpl = parsed.template_id || parsed.templateId || null;
      }
      if (tpl) {
        try {
          await prisma.archivedEvent.update({ where: { id: r.id }, data: { template_id: tpl } });
          console.log('Backfilled archivedEvent', r.id, '->', tpl);
        } catch (e) {
          console.warn('Failed to update archivedEvent', r.id, e && e.message);
        }
      }
    }
    skip += rows.length;
    console.log('Processed', skip);
  }
}

(async () => {
  try {
    await backfillEvents();
    await backfillArchived();
    console.log('Backfill complete');
  } catch (e) {
    console.error('Backfill failed', e && e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
