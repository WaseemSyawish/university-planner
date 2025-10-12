// inspects latest events using Prisma Client
// Usage: node scripts/inspect_events.js

const dotenv = require('dotenv');
dotenv.config();

const { PrismaClient } = require('@prisma/client');

(async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.event.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        title: true,
        date: true,
        time: true,
        end_date: true,
        meta: true,
        created_at: true,
        course_id: true,
        user_id: true
      }
    });
    console.log('Found', rows.length, 'events');
    for (const r of rows) {
      console.log(JSON.stringify(r, null, 2));
    }
  } catch (e) {
    console.error('Query failed:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
