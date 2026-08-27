import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Comprehensive Mega Seed...');

  // 1. Clean existing database records (in order of relations)
  console.log('🧹 Clearing existing records...');
  await prisma.ticket.deleteMany({});
  await prisma.voucher.deleteMany({});
  await prisma.cardCode.deleteMany({});
  await prisma.card.deleteMany({});
  await prisma.postLike.deleteMany({});
  await prisma.postComment.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.eventLike.deleteMany({});
  await prisma.eventComment.deleteMany({});
  await prisma.eventConnectionRequest.deleteMany({});
  await prisma.ticketType.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.followRequest.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.school.deleteMany({});

  console.log('🧹 Database clean complete.');

  // 2. Hash standard passwords
  const passwordAdmin = await bcrypt.hash('admin@123', 10);
  const passwordSchoolAdmin = await bcrypt.hash('schooladmin', 10);
  const passwordStudent = await bcrypt.hash('password123', 10);

  // 3. Create Schools
  console.log('🌱 Seeding Schools...');
  const schoolsData = [
    { name: 'TiKit Academy', slug: 'tikit-academy', schoolCode: 'TK123', city: 'Stockholm' },
    { name: 'North High School', slug: 'north-high', schoolCode: 'NHS001', city: 'Stockholm' },
    { name: 'South Academy', slug: 'south-academy', schoolCode: 'SAC002', city: 'Gothenburg' },
    { name: 'Global Tech College', slug: 'global-tech', schoolCode: 'GTC003', city: 'Malmö' },
  ];

  const createdSchools: any[] = [];
  for (const s of schoolsData) {
    const school = await prisma.school.create({
      data: {
        ...s,
        isVerified: true,
        isActive: true,
      },
    });
    createdSchools.push(school);
  }
  const mainSchool = createdSchools[0]; // TiKit Academy
  console.log(`✅ ${createdSchools.length} Schools created.`);

  // 4. Create Administrators
  console.log('🌱 Seeding Administrators...');
  
  // A. Tikit Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@gmail.com',
      username: 'tikit_admin',
      displayName: 'Super Admin',
      password: passwordAdmin,
      role: 'TIKIT_ADMIN',
      accountStatus: 'ACTIVE',
      schoolId: mainSchool.id,
      isVerified: true,
      approvalStatus: 'approved',
    },
  });

  // B. School Admin (linked to TiKit Academy)
  const schoolAdmin = await prisma.user.create({
    data: {
      email: 'schooladmin@gmail.com',
      username: 'school_admin',
      displayName: 'School Admin',
      password: passwordSchoolAdmin,
      role: 'KARORDFORANDE',
      accountStatus: 'ACTIVE',
      schoolId: mainSchool.id,
      isVerified: true,
      approvalStatus: 'approved',
    },
  });

  // C. Other School Admins
  for (let i = 1; i < createdSchools.length; i++) {
    const school = createdSchools[i];
    await prisma.user.create({
      data: {
        email: `admin@${school.slug}.com`,
        username: `admin_${school.slug.replace('-', '_')}`,
        displayName: `${school.name} Admin`,
        password: passwordStudent,
        role: 'KARORDFORANDE',
        accountStatus: 'ACTIVE',
        schoolId: school.id,
        isVerified: true,
        approvalStatus: 'approved',
      },
    });
  }

  console.log('✅ Administrators seeded successfully.');

  // 5. Create Student Users
  console.log('🌱 Seeding Students...');
  const students: any[] = [];
  const studentEmails = [
    { email: 'student1@gmail.com', username: 'student1', name: 'Alice Andersson' },
    { email: 'student2@gmail.com', username: 'student2', name: 'Bob Bergqvist' },
    { email: 'student3@gmail.com', username: 'student3', name: 'Charlie Carlsson' },
    { email: 'student4@gmail.com', username: 'student4', name: 'Diana Dahlström' },
    { email: 'student5@gmail.com', username: 'student5', name: 'Emil Eriksson' },
  ];

  for (let i = 0; i < studentEmails.length; i++) {
    const s = studentEmails[i];
    const targetSchool = createdSchools[i % createdSchools.length];
    const student = await prisma.user.create({
      data: {
        email: s.email,
        username: s.username,
        displayName: s.name,
        password: passwordStudent,
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        schoolId: targetSchool.id,
        isVerified: true,
        approvalStatus: 'approved',
        cardStatus: 'active',
      },
    });
    students.push(student);
  }
  console.log(`✅ ${students.length} Students seeded successfully.`);

  // 6. Create Events with Ticket Types
  console.log('🌱 Seeding Events & Ticket Types...');
  const eventTypes = ['INTERNAL', 'EXTERNAL'];
  const createdEvents: any[] = [];

  for (let i = 0; i < createdSchools.length; i++) {
    const school = createdSchools[i];
    for (let j = 1; j <= 2; j++) {
      const event = await prisma.event.create({
        data: {
          title: `${school.name} Event #${j}`,
          description: `This is a beautiful dynamic event organized by ${school.name}. Join us for an amazing experience!`,
          eventType: eventTypes[j % 2],
          schoolId: school.id,
          venueName: 'Grand Assembly Hall',
          venueAddress: `School Street ${j}, ${school.city}`,
          startsAt: new Date(Date.now() + j * 86400000), // j days from now
          endsAt: new Date(Date.now() + j * 86400000 + 4 * 3600000), // 4 hours later
          isPublished: true,
          status: 'published',
          ticketTypes: {
            create: [
              { name: 'Early Bird', price: 99, quantityTotal: 30, quantityRemaining: 30 },
              { name: 'Standard Admission', price: 199, quantityTotal: 100, quantityRemaining: 100 },
            ],
          },
        },
        include: {
          ticketTypes: true,
        },
      });
      createdEvents.push(event);
    }
  }
  console.log(`✅ ${createdEvents.length} Events with Ticket Types created.`);

  // 7. Create Student Cards
  console.log('🌱 Seeding Student Cards...');
  for (const school of createdSchools) {
    const card = await prisma.card.create({
      data: {
        title: `${school.name} Digital Union Card`,
        schoolId: school.id,
        description: `Official digital student union membership card for ${school.name}. Offers exclusive student benefits and fast-track access to all school events.`,
        benefits: ['Free entry to internal events', '10% discount on standard admission tickets', 'Campus cafe discounts'],
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 3600000), // Valid for 1 year
        status: 'active',
      },
    });
  }
  console.log(`✅ Student Cards created for all schools.`);

  // 8. Create Tickets (Assign to Students)
  console.log('🌱 Seeding Tickets for Students...');
  let ticketCount = 0;
  for (const student of students) {
    // Give each student a ticket to the first two events
    for (let k = 0; k < Math.min(2, createdEvents.length); k++) {
      const event = createdEvents[k];
      const ticketType = event.ticketTypes[0]; // Early Bird ticket

      // Generate a unique ticket code and QR token
      const ticketCode = `TK-${uuidv4().substring(0, 8).toUpperCase()}`;
      const qrToken = `QR-${uuidv4().substring(0, 16).toUpperCase()}`;

      await prisma.ticket.create({
        data: {
          userId: student.id,
          eventId: event.id,
          ticketTypeId: ticketType.id,
          code: ticketCode,
          qrToken: qrToken,
          status: 'ISSUED',
        },
      });

      // Decrement the remaining quantity on the ticket type
      await prisma.ticketType.update({
        where: { id: ticketType.id },
        data: {
          quantityRemaining: {
            decrement: 1,
          },
        },
      });

      ticketCount++;
    }
  }
  console.log(`✅ ${ticketCount} Tickets successfully issued to Students.`);

  console.log('\n✨ Comprehensive Mega Seed Successfully Completed!');
  console.log('----------------------------------------------------');
  console.log('🔑 TIKIT ADMIN CREDENTIALS:');
  console.log('   Email    : admin@gmail.com');
  console.log('   Password : admin@123');
  console.log('🔑 SCHOOL ADMIN CREDENTIALS:');
  console.log('   Email    : schooladmin@gmail.com');
  console.log('   Password : schooladmin');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
