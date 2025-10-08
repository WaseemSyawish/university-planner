const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main(){
  const id = 'smoke_user';
  const email = 'smoketest+id@example.com';
  // Upsert to avoid duplicates
  const u = await p.user.upsert({
    where: { id },
    update: { email },
    create: { id, email, name: 'Smoke Test User (id)' }
  });
  console.log('Upserted user', u.id);
}

main().catch(e=>{ console.error(e); process.exit(1); }).finally(async ()=>{ await p.$disconnect(); });
