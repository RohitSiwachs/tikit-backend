import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Mega Seed...');

  // 1. Clear existing data (Optional, but good for a clean start)
  // await prisma.ticket.deleteMany({});
  // await prisma.event.deleteMany({});
  // await prisma.school.deleteMany({});

  const password = await bcrypt.hash('password123', 10);

  // 2. Create Schools
  const schools = [
    { name: 'North High School', slug: 'north-high', schoolCode: 'NHS001', city: 'Stockholm' },
    { name: 'South Academy', slug: 'south-academy', schoolCode: 'SAC002', city: 'Gothenburg' },
    { name: 'Global Tech College', slug: 'global-tech', schoolCode: 'GTC003', city: 'Malmö' },
  ];

  const createdSchools: any[] = [];
  for (const s of schools) {
    const school = await prisma.school.upsert({
      where: { slug: s.slug },
      update: {},
      create: { ...s, isVerified: true },
    });
    createdSchools.push(school);
  }
  console.log('✅ 3 Schools created');

  // 3. Create Users for each school
  for (const school of createdSchools) {
    await prisma.user.upsert({
      where: { email: `admin@${school.slug}.com` },
      update: {},
      create: {
        email: `admin@${school.slug}.com`,
        username: `admin_${school.slug.replace('-', '_')}`,
        displayName: `${school.name} Admin`,
        password,
        role: 'KARORDFORANDE',
        schoolId: school.id,
        isVerified: true,
        approvalStatus: 'approved',
      },
    });
  }
  console.log('✅ School Admins created');

  // 4. Create Events
  const eventTypes = ['INTERNAL', 'EXTERNAL'];
  for (const school of createdSchools) {
    for (let i = 1; i <= 5; i++) {
      await prisma.event.create({
        data: {
          title: `Event ${i} at ${school.name}`,
          description: `This is the description for event number ${i}`,
          eventType: eventTypes[i % 2],
          schoolId: school.id,
          venueName: 'Main Hall',
          startsAt: new Date(Date.now() + i * 86400000), // 1 day apart
          endsAt: new Date(Date.now() + i * 86400000 + 3600000),
          isPublished: i % 2 === 0,
          ticketTypes: {
            create: [
              { name: 'Early Bird', price: 100, quantityTotal: 50, quantityRemaining: 50 },
              { name: 'Standard', price: 250, quantityTotal: 100, quantityRemaining: 100 },
            ],
          },
        },
      });
    }
  }
  console.log('✅ 15 Events created');

  // 5. Create Cards
  for (const school of createdSchools) {
    await prisma.card.create({
      data: {
        title: `${school.name} Student Card`,
        schoolId: school.id,
        description: 'Access to all school facilities and discounts.',
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 31536000000), // 1 year
        status: 'active',
      },
    });
  }
  console.log('✅ 3 Cards created');

  console.log('\n✨ Mega Seed Complete!');
  console.log('Use email: admin@north-high.com');
  console.log('Password: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
