const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Simulating event creation with exact payload...");
    const res = await prisma.event.create({
      data: {
        title: "demo event 4",
        description: "demo description",
        eventType: "INTERNAL",
        schoolId: "1d138eb6-bafe-4a86-bfb6-98e57d9a12c9",
        startsAt: new Date("2026-07-21T20:00:00.000Z"),
        endsAt: new Date("2026-07-21T22:00:00.000Z"),
        externalBuyUrl: "demo event 4",
        ticketTypes: {
          create: [{
            name: "demo_tikit-4",
            description: "demo_tikit-4 is the tikit for the demo event",
            price: 7000,
            quantityTotal: 15,
            quantityRemaining: 15
          }]
        }
      }
    });
    console.log("\n✅ SUCCESS! EVENT CREATED:");
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("\n❌ DATABASE ERROR:");
    console.error("Error Name:", err.constructor.name);
    console.error("Error Message:", err.message);
    if (err.code) console.error("Error Code:", err.code);
  } finally {
    await prisma.$disconnect();
  }
}

run();
