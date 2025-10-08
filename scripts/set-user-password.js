#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

async function main() {
  const args = process.argv.slice(2);
  const userId = args[0] || process.env.USER_ID;
  const password = args[1] || process.env.PASSWORD;
  if (!userId) {
    console.error('Usage: node scripts/set-user-password.js <userId> [newPassword]\nOr set env USER_ID and optionally PASSWORD');
    process.exit(2);
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.error('User not found:', userId);
      process.exit(3);
    }
    if (!password) {
      console.log(`User ${user.email} (${user.id}) found.`);
      console.log('Has password_hash:', !!user.password_hash);
      process.exit(0);
    }
    if (password.length < 8) {
      console.error('Password must be at least 8 characters');
      process.exit(4);
    }
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: userId }, data: { password_hash: hash } });
    console.log(`Password for ${user.email} (${user.id}) updated.`);
    process.exit(0);
  } catch (err) {
    console.error('Error', err);
    process.exit(1);
  }
}

main();
