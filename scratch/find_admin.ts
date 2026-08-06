import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'SUPER_ADMIN' },
        { role: 'ADMIN' },
        { email: { contains: 'admin' } }
      ]
    },
    select: {
      id: true,
      email: true,
      role: true,
      displayName: true
    }
  });

  console.log('Found Admins:', admins);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
