const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async function(){
  try {
    const rows = await p.event.findMany({ where: { title: { contains: 'Materialize test' } }, orderBy: { created_at: 'desc' }, take: 20 });
    console.log(JSON.stringify(rows.map(r=>({ id: r.id, title: r.title, date: r.date, end_date: r.end_date, created_at: r.created_at })), null, 2));
  } catch(e) {
    console.error('Query failed:', e && e.message ? e.message : e);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
