const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Attempting to insert event with MALFORMED UUID schoolId...");
    await prisma.event.create({
      data: {
        title: "test-malformed-uuid",
        schoolId: "1234", // Malformed UUID (not a 36-character UUID string)
        startsAt: new Date("2026-07-21T20:00:00Z"),
        endsAt: new Date("2026-07-21T22:00:00Z"),
        ticketTypes: {
          create: [{
            name: "test-ticket",
            price: 100,
            quantityTotal: 10,
            quantityRemaining: 10
          }]
        }
      }
    });
    console.log("Success (unexpected)!");
  } catch (err) {
    console.log("\n❌ MALFORMED UUID CAUGHT ERROR:");
    console.log("Constructor:", err.constructor.name);
    console.log("Message:", err.message);
    if (err.code) console.log("Code:", err.code);
  } finally {
    await prisma.$disconnect();
  }
}

run();
