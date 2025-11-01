#!/usr/bin/env node
// scripts/create-test-event.js
// Creates a simple event for testing and prints the id
const prisma = require('../lib/prisma');
(async () => {
  try {
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({ data: { email: 'dev+test@example.com', name: 'dev', password_hash: null } });
    }
    const dt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const ev = await prisma.event.create({ data: {
      title: 'TEST SERIES MAIN',
      type: 'lecture',
      date: dt,
      time: '09:00',
      description: 'Test main event',
      user_id: user.id
    }});
    console.log('CREATED_EVENT_ID', ev.id);
  } catch (e) {
    console.error('create-test-event failed', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
