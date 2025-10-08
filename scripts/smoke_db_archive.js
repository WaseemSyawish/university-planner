// scripts/smoke_db_archive.js
// DB-level smoke test using Prisma Client to verify archive/unarchive logic
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB-level smoke test');
  // Find or create a test user
  const testEmail = 'smoketest@example.com';
  let user = await prisma.user.findUnique({ where: { email: testEmail } });
  if (!user) {
    user = await prisma.user.create({ data: { email: testEmail, name: 'Smoke Test User' } });
  }
  const userId = user.id;

  // 1. Create event
  const ev = await prisma.event.create({
    data: {
      title: 'DB Smoke Test Event',
      type: 'other',
      course_id: null,
      date: new Date(),
      time: '12:00',
      description: 'Created by smoke test',
      completed: false,
      archived: false,
      user_id: userId
    }
  });
  console.log('Created event id:', ev.id);

  // 2. Archive -> copy to archived_events and delete original
  const archived = await prisma.archivedEvent.create({
    data: {
      original_event_id: ev.id,
      title: ev.title,
      type: ev.type,
      course_id: ev.course_id,
      date: ev.date,
      time: ev.time,
      description: ev.description,
      completed: ev.completed,
      user_id: ev.user_id
    }
  });
  console.log('Archived event id:', archived.id, 'original_event_id:', archived.original_event_id);

  await prisma.event.delete({ where: { id: ev.id } });
  console.log('Deleted original event');

  // 3. Verify archived exists
  const foundArchived = await prisma.archivedEvent.findUnique({ where: { original_event_id: ev.id } });
  console.log('Found archived by original_event_id:', !!foundArchived);

  // 4. Unarchive -> create event from archived and delete archived record
  const recreated = await prisma.event.create({
    data: {
      title: archived.title,
      type: archived.type,
      course_id: archived.course_id,
      date: archived.date,
      time: archived.time,
      description: archived.description,
      completed: archived.completed,
      archived: false,
      user_id: archived.user_id
    }
  });
  console.log('Recreated event id:', recreated.id);

  await prisma.archivedEvent.delete({ where: { original_event_id: ev.id } });
  console.log('Deleted archived record');

  // 5. Final verification
  const stillInEvents = await prisma.event.findUnique({ where: { id: recreated.id } });
  const stillInArchived = await prisma.archivedEvent.findUnique({ where: { original_event_id: ev.id } });
  console.log('Recreated present in events:', !!stillInEvents);
  console.log('Archived record present:', !!stillInArchived);

  console.log('DB-level smoke test completed');
}

main()
  .catch((e) => { console.error('Error in smoke test:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
