// tests creating an event via Prisma Client to verify end_date persistence
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async function main() {
  try {
    // Find any user; create a test user if none
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({ data: { email: `test+${Date.now()}@example.com`, name: 'Test User' } });
      console.log('Created test user', user.id);
    }

    const now = new Date();
    const start = new Date(now.getTime() + 1000 * 60 * 60 * 24); // tomorrow
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 1000 * 60 * 60 * 2 + 1000 * 60 * 15); // +2h15m

    const created = await prisma.event.create({
      data: {
        title: `Automated test event ${Date.now()}`,
        type: 'personal',
        date: start,
        time: `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`,
        end_date: end,
        user_id: user.id,
      }
    });

    console.log('Created event ID:', created.id);

    const fetched = await prisma.event.findUnique({ where: { id: created.id }, select: { id: true, title: true, date: true, time: true, end_date: true, meta: true, user_id: true } });
    console.log('Fetched row:', JSON.stringify(fetched, null, 2));

    process.exit(0);
  } catch (e) {
    console.error('Error creating/fetching event:', e && e.message ? e.message : e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
