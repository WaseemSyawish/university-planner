// scripts/create-test-user.js
// Creates or upserts a test user required by other scripts (prisma-check.js)
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const testUserId = 'aef344d3-e602-402d-85de-055ba3c4629b';
    console.log('Upserting test user with id', testUserId);
    const user = await prisma.user.upsert({
      where: { id: testUserId },
      update: { email: 'dev@example.com', name: 'Dev User' },
      create: { id: testUserId, email: 'dev@example.com', name: 'Dev User' },
    });
    console.log('Upserted user:', user.id, user.email);
  } catch (err) {
    console.error('Failed to upsert test user:', err);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
})();
