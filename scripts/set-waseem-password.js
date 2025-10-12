require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = 'waseemdenha72@gmail.com';
  const password = 'Ooppllmm1';
  const prisma = new PrismaClient();
  try {
    const upserted = await prisma.user.upsert({
      where: { email },
      update: { name: 'Waseem Denha' },
      create: { email, name: 'Waseem Denha' },
    });
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { email }, data: { password_hash: hash } });
    console.log(`Password for ${email} set to Ooppllmm1.`);
    process.exit(0);
  } catch (err) {
    console.error('Error creating/updating user/password', err);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
}

main();