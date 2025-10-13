const prisma = require('../lib/prisma');

(async function main(){
  try {
    // Select only fields that exist in the current Prisma schema
    const rows = await prisma.event.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
      select: { id: true, title: true, date: true, time: true, end_date: true, meta: true, created_at: true }
    });

    console.log(JSON.stringify(rows.map(ev=>({
      id: ev.id,
      title: ev.title,
      date: ev.date,
      time: ev.time,
      end_date: ev.end_date,
      meta: ev.meta,
      created_at: ev.created_at
    })), null, 2));
    process.exit(0);
  } catch (e) {
    console.error('inspect_recent_events_local failed (prisma findMany)', e && e.message ? e.message : e);
    // Fallback to raw SQL in case Prisma client schema differs from the DB
    try {
      const fallback = await prisma.$queryRaw`SELECT id, title, date, time, end_date, meta, created_at FROM events ORDER BY created_at DESC LIMIT 50`;
      console.log(JSON.stringify(fallback, null, 2));
      process.exit(0);
    } catch (e2) {
      console.error('inspect_recent_events_local failed (fallback query)', e2 && e2.message ? e2.message : e2);
      process.exit(1);
    }
  }
})();
