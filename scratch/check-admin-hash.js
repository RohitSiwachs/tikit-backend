const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Connecting...");
  await prisma.$connect();
  console.log("Connected.");
  
  let start = Date.now();
  await prisma.user.findUnique({ where: { email: 'admin@gmail.com' } });
  console.log(`First query took ${Date.now() - start}ms`);
  
  start = Date.now();
  await prisma.user.findUnique({ where: { email: 'admin@gmail.com' } });
  console.log(`Second query took ${Date.now() - start}ms`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
