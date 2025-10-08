// scripts/prisma-insert-persist.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const created = await prisma.event.create({ data: {
      title: 'Prisma persistent test',
      type: 'assignment',
      date: new Date(),
      time: null,
      description: 'persist test - should remain visible in Studio',
      completed: false,
      archived: false,
      user_id: 'aef344d3-e602-402d-85de-055ba3c4629b'
    }});
    console.log('Created persistent event id:', created.id);
  } catch (err) {
    console.error('Error creating persistent event:', err);
    process.exitCode = 2;
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
})();
