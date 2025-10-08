const prisma = require('../lib/prisma');
const args = process.argv.slice(2);

// Usage: node scripts/delete-templates-events.js --templates id1,id2 --events id3,id4 [--confirm]
function parseList(val) {
  if (!val) return [];
  return String(val).split(',').map(s => s.trim()).filter(Boolean);
}

const opts = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--templates') opts.templates = parseList(args[++i]);
  else if (a === '--events') opts.events = parseList(args[++i]);
  else if (a === '--confirm') opts.confirm = true;
}

async function main() {
  const { templates = [], events = [], confirm = false } = opts;
  if (!templates.length && !events.length) {
    console.log('No ids provided. Use --templates id1,id2 and/or --events id3,id4');
    return;
  }

  console.log(`[delete] dry-run mode. Set --confirm to actually delete. Found templates:${templates.length} events:${events.length}`);

  if (templates.length) {
    for (const t of templates) {
      const tpl = await prisma.eventTemplate.findUnique({ where: { id: t } });
      if (!tpl) {
        console.log(`[delete] template ${t} not found`);
        continue;
      }
      const evCount = await prisma.event.count({ where: { template_id: t } });
      console.log(`[delete] template ${t} title='${tpl.title}' events=${evCount}`);
      if (confirm) {
        // delete child events first then template in a transaction
        await prisma.$transaction(async (tx) => {
          await tx.event.deleteMany({ where: { template_id: t } });
          await tx.eventTemplate.delete({ where: { id: t } });
        });
        console.log(`[delete] template ${t} and ${evCount} events removed`);
      }
    }
  }

  if (events.length) {
    for (const e of events) {
      const ev = await prisma.event.findUnique({ where: { id: e } });
      if (!ev) { console.log(`[delete] event ${e} not found`); continue; }
      console.log(`[delete] event ${e} title='${ev.title}' date=${ev.date} template_id=${ev.template_id || 'none'}`);
      if (confirm) {
        await prisma.event.delete({ where: { id: e } });
        console.log(`[delete] event ${e} removed`);
      }
    }
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
