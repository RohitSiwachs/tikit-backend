const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Connecting to database...");
    
    // Check Schools
    const schools = await prisma.school.findMany({
      select: { id: true, name: true, schoolCode: true }
    });
    console.log("\n🏫 SCHOOLS IN DATABASE:", schools.length);
    console.log(JSON.stringify(schools, null, 2));

    // Check Events
    const events = await prisma.event.findMany({
      take: 5,
      select: { id: true, title: true, schoolId: true }
    });
    console.log("\n📅 EVENTS IN DATABASE (First 5):", events.length);
    console.log(JSON.stringify(events, null, 2));

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
