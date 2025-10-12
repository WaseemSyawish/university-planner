require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const args = process.argv.slice(2);
  const userId = args[0] || process.env.USER_ID;
  const password = args[1] || process.env.PASSWORD;
  const email = process.env.EMAIL || (userId ? `dev+${userId.slice(0,8)}@example.com` : null);

  if (!userId || !password) {
    console.error('Usage: node scripts/create-and-set-password.js <userId> <password>\nOr set env USER_ID and PASSWORD');
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const upserted = await prisma.user.upsert({
      where: { id: userId },
      update: { email, name: 'Dev User' },
      create: { id: userId, email, name: 'Dev User' },
    });

    if (!password || password.length < 8) {
      console.error('Password must be at least 8 characters');
      process.exit(4);
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: userId }, data: { password_hash: hash } });

    console.log(`Password for ${upserted.email} (${userId}) created/updated successfully.`);
    process.exit(0);
  } catch (err) {
    console.error('Error creating/updating user/password', err);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
}

main();
