const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Fetching existing events with their ticketTypes...");
    const events = await prisma.event.findMany({
      include: {
        ticketTypes: true,
        school: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${events.length} events:`);
    console.log(JSON.stringify(events, null, 2));

  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
