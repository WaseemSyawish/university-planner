// Shared Prisma client to avoid creating/disconnecting clients per-request
const { PrismaClient } = require('@prisma/client');

// Use Node's global object for compatibility with ESLint environments
const globalForPrisma = global;

let prisma;
if (!globalForPrisma.__prisma) {
  globalForPrisma.__prisma = new PrismaClient();
}

prisma = globalForPrisma.__prisma;

module.exports = prisma;
