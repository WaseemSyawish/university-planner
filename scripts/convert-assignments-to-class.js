// Script: convert-assignments-to-class.js
// Usage: node scripts/convert-assignments-to-class.js
// This will update all non-archived events whose `type` is 'assignment' to 'class'.

const prisma = require('../lib/prisma');

(async () => {
  try {
    console.log('Counting events with type=assignment...');
    const countBefore = await prisma.event.count({ where: { type: 'assignment', archived: false } });
    console.log(`Found ${countBefore} assignment events (non-archived).`);

    if (countBefore === 0) {
      console.log('Nothing to update. Exiting.');
      process.exit(0);
    }

    const res = await prisma.event.updateMany({ where: { type: 'assignment', archived: false }, data: { type: 'class' } });
    console.log(`Updated ${res.count} rows from 'assignment' to 'class'.`);

    const countAfter = await prisma.event.count({ where: { type: 'assignment', archived: false } });
    console.log(`Remaining assignment events (non-archived): ${countAfter}`);

    process.exit(0);
  } catch (err) {
    console.error('Error while converting assignment events:', err);
    process.exit(1);
  }
})();
