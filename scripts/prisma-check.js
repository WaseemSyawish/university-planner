// scripts/prisma-check.js
// Loads .env, prints DATABASE_URL vars, attempts to connect to Prisma and list/insert/delete an Event row.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

(async () => {
  console.log('ENV DATABASE_URL:', process.env.DATABASE_URL);
  console.log('ENV DATABASE_URL_SQLITE:', process.env.DATABASE_URL_SQLITE);
  const prisma = new PrismaClient();
  try {
    console.log('Connecting to Prisma...');
    await prisma.$connect();
    console.log('Connected. Counting events...');
    const count = await prisma.event.count().catch(e => { console.error('count error', e); return null; });
    console.log('Event count:', count);

    // Try a safe create -> then delete to test write
    console.log('Attempting safe create...');
    const created = await prisma.event.create({ data: {
      title: 'Prisma check event',
      type: 'assignment',
      date: new Date(),
      time: null,
      description: 'temp',
      completed: false,
      archived: false,
      user_id: 'aef344d3-e602-402d-85de-055ba3c4629b'
    }}).catch(e => { console.error('create error', e); return null; });

    console.log('Created:', created ? created.id : null);
    if (created && created.id) {
      const found = await prisma.event.findUnique({ where: { id: created.id } }).catch(e => { console.error('findUnique error', e); return null; });
      console.log('Found created:', !!found);
      await prisma.event.delete({ where: { id: created.id } }).catch(e => { console.error('delete error', e); });
      console.log('Deleted created event (cleanup)');
    }
  } catch (err) {
    console.error('Prisma check error:', err);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
})();
