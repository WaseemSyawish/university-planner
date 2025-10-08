require('dotenv').config();
const prisma = require('../lib/prisma');

(async () => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, password_hash: true } });
    console.log(`Found ${users.length} users:`);
    users.forEach(u => console.log(u.id, '|', u.email, '| password_hash:', !!u.password_hash));
    process.exit(0);
  } catch (err) {
    console.error('Failed to list users:', err);
    process.exit(1);
  }
})();
