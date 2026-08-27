const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function activate() {
  const codeStr = '538-835-749-149';
  const userId = 'c86ea1ca-04af-4719-9727-25a05252f24a';

  try {
    const cardCode = await prisma.cardCode.findUnique({
      where: { code: codeStr },
    });

    if (!cardCode) {
      console.log('Card code not found');
      return;
    }

    const updated = await prisma.cardCode.update({
      where: { id: cardCode.id },
      data: { isUsed: true, usedAt: new Date(), userId },
    });

    console.log('Card successfully activated in DB!', updated);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

activate();
