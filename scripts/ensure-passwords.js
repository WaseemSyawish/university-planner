#!/usr/bin/env node
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function main() {
  try {
    const users = await prisma.user.findMany();
    const noPass = users.filter(u => !u.password_hash);
    console.log(`Found ${users.length} users, ${noPass.length} missing passwords.`);
    if (noPass.length === 0) return;

    const envPass = process.env.PASSWORD;
    let password = envPass;
    if (!password) {
      password = await prompt('Enter a default password to set for users missing passwords (will not echo): ');
    }
    if (!password || password.length < 8) {
      console.error('Password required and must be at least 8 characters. Exiting.');
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 10);
    for (const u of noPass) {
      await prisma.user.update({ where: { id: u.id }, data: { password_hash: hash } });
      console.log(`Set password for user ${u.email} (${u.id})`);
    }
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error', err);
    process.exit(2);
  }
}

main();
