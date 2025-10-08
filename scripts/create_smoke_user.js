const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main(){
  const u = await p.user.create({ data: { email: 'smoketest@example.com', name: 'Smoke Test User' } });
  console.log('Created user', u.id);
}

main().catch(e=>{ console.error(e); process.exit(1); }).finally(async ()=>{ await p.$disconnect(); });
