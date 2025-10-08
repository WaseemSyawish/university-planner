const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const events = await prisma.event.findMany({ where: { title: { contains: 'kill' } } });
    console.log('Found', events.length, 'events');
    for (const ev of events) {
      console.log('Deleting', ev.id, ev.title);
      await prisma.event.delete({ where: { id: ev.id } });
    }
    console.log('Done');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
