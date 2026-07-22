const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { randomUUID } = require('crypto');

async function main() {
  console.log('Testing the exact POST /events payload against the database...');
  try {
    const event = await prisma.event.create({
      data: {
        title: "test event",
        description: "mera nya event",
        attendanceVisibility: "school",
        coverUrl: "https://pub-c1e1f777edce411ba50fa83a86731d8b.r2.dev/events/13de0ad1-096d-4fdd-9029-10635a34eee0-a",
        endsAt: new Date("2026-07-24T02:00:00"),
        eventType: "INTERNAL",
        isPinned: false,
        schoolId: "4236850a-b87f-4604-95b8-95da6e9ea7b3",
        showImGoingButton: true,
        startsAt: new Date("2026-06-21T01:02:00"),
        status: "published",
        venueAddress: "mnjulika bhavan",
        venueName: "test room",
        id: randomUUID(),
        postedBySuperAdmin: false,
        ticketTypes: {
          create: [
            { name: "General Admission", description: "Default ticket", price: 0, quantityTotal: 0, quantityRemaining: 0, freeForHostSchool: true }
          ]
        }
      }
    });
    console.log('Success:', event.id);
  } catch (error) {
    console.error('Failed! Prisma Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
