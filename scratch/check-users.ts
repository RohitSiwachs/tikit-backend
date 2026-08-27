import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
    }
  });
  console.log('--- ALL USERS IN PRISMA DATABASE ---');
  console.log(users);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
