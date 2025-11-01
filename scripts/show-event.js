#!/usr/bin/env node
const prisma = require('../lib/prisma');
const args = process.argv.slice(2);
if (!args[0]) {
  console.error('Usage: node scripts/show-event.js <eventId>');
  process.exit(1);
}
const id = args[0];
(async () => {
  try {
    const ev = await prisma.event.findUnique({ where: { id }, select: { id: true, title: true, date: true, time: true, description: true, meta: true, template_id: true } });
    console.log(JSON.stringify(ev, null, 2));
  } catch (e) {
    console.error('Failed to fetch event:', e && e.message || e);
  } finally {
    await prisma.$disconnect();
  }
})();
