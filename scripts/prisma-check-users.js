const { PrismaClient } = require('@prisma/client');
(async function(){
  const p = new PrismaClient();
  try {
    const res = await p.$queryRaw`PRAGMA table_info('users')`;
    const normalized = res.map(r => {
      const out = {};
      for (const k of Object.keys(r)) {
        const v = r[k];
        out[k] = typeof v === 'bigint' ? String(v) : v;
      }
      return out;
    });
    console.log(JSON.stringify(normalized, null, 2));
  } catch(e){
    console.error('ERR', e);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();