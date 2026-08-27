const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Attempting to insert event with INVALID schoolId...");
    await prisma.event.create({
      data: {
        title: "test-invalid-school",
        schoolId: "non-existent-school-id-uuid", // Invalid UUID
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
    console.log("\n❌ INSERTION CAUGHT ERROR:");
    console.log("Constructor:", err.constructor.name);
    console.log("Message:", err.message);
    console.log("Code:", err.code);
    console.log("Meta:", err.meta);
  } finally {
    await prisma.$disconnect();
  }
}

run();
