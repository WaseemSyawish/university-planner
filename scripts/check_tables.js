const prisma = require('../lib/prisma');

(async () => {
  try {
    const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('TABLES:', tables.map(t => t.name));
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('PRISMA_ERR', e);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
