const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const c = await prisma.event.count({ where: { title: { contains: 'kill' } } });
    console.log('count', c);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
