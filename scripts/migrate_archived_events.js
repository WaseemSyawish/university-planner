/*
  scripts/migrate_archived_events.js

  Usage:
    # Install/generate Prisma client first
    npx prisma generate

    # Preview only (won't delete originals)
    node scripts/migrate_archived_events.js --preview

    # Run migration (copy and delete originals)
    node scripts/migrate_archived_events.js --run

  This script will:
  - Find rows in `events` where archived = true
  - Insert a corresponding row into `archived_events` with original_event_id set
  - Delete the original row from `events` (only when run with --run)
*/

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const preview = args.includes('--preview') && !args.includes('--run');
  const run = args.includes('--run');

  console.log('Migration script for archived events');
  console.log('Preview mode:', preview);
  console.log('Run mode:', run);

  const archived = await prisma.event.findMany({ where: { archived: true } });
  console.log(`Found ${archived.length} archived events in events table.`);

  if (archived.length === 0) {
    console.log('Nothing to migrate. Exiting.');
    return;
  }

  for (const ev of archived) {
    console.log('---');
    console.log('Event ID:', ev.id);
    console.log('Title:', ev.title);
    console.log('Date:', ev.date.toISOString());

    const already = await prisma.archivedEvent.findUnique({ where: { original_event_id: ev.id } });
    if (already) {
      console.log('Already migrated, skipping.');
      continue;
    }

    console.log('Prepared archived row:');
    const payload = {
      original_event_id: ev.id,
      title: ev.title,
      type: ev.type,
      course_id: ev.course_id,
      date: ev.date,
      time: ev.time,
      description: ev.description,
      completed: ev.completed,
      user_id: ev.user_id
    };
    console.log(payload);

    if (preview) continue;

    // Create archived record
    const created = await prisma.archivedEvent.create({ data: payload });
    console.log('Created archived event with id:', created.id);

    if (run) {
      // Delete original
      await prisma.event.delete({ where: { id: ev.id } });
      console.log('Deleted original event', ev.id);
    }
  }

  console.log('Migration script completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
