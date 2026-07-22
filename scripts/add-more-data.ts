import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Adding more data to the database...');

  // 1. Get existing host school and users to link new data
  const hostSchool = await prisma.school.findFirst({ where: { slug: 'tikit-academy' } });
  const externalSchool = await prisma.school.findFirst({ where: { slug: 'north-high' } });
  const admin = await prisma.user.findFirst({ where: { email: 'admin@gmail.com' } });
  const schoolAdmin = await prisma.user.findFirst({ where: { email: 'dummyschool@gmail.com' } });
  const student = await prisma.user.findFirst({ where: { email: 'demostudent@gmail.com' } });

  if (!hostSchool || !externalSchool || !admin || !schoolAdmin || !student) {
    console.error('❌ Base users or schools not found. Please run the initial seed first.');
    process.exit(1);
  }

  // 2. Create more users (students) for TiKit Academy
  console.log('👤 Creating more students...');
  const pw = await bcrypt.hash('password123', 10);
  const newStudents: any[] = [];
  for (let i = 1; i <= 10; i++) {
    const s = await prisma.user.create({
      data: {
        email: `student${i}@tikit.academy`,
        username: `tikit_student_${i}`,
        displayName: `TiKit Student ${i}`,
        password: pw,
        role: 'STUDENT',
        schoolId: hostSchool.id,
        isVerified: true,
        approvalStatus: 'approved',
        cardStatus: 'active',
      },
    });
    newStudents.push(s);
  }
  console.log(`✅ Created 10 more students for TiKit Academy`);

  // 3. Create more events for TiKit Academy
  console.log('🎫 Creating more events...');
  const eventsData = [
    { title: 'Winter Gala', type: 'INTERNAL', days: 15 },
    { title: 'Career Fair 2026', type: 'INTERNAL', days: 20 },
    { title: 'Tech Symposium', type: 'EXTERNAL', days: 25 },
    { title: 'Alumni Meetup', type: 'INTERNAL', days: 30 },
    { title: 'Spring Festival', type: 'EXTERNAL', days: 45 },
  ];

  for (const ed of eventsData) {
    await prisma.event.create({
      data: {
        title: ed.title,
        description: `Join us for the amazing ${ed.title}!`,
        eventType: ed.type as any,
        schoolId: hostSchool.id,
        venueName: 'Main Campus',
        startsAt: new Date(Date.now() + ed.days * 86400000),
        endsAt: new Date(Date.now() + ed.days * 86400000 + 4 * 3600000),
        isPublished: true,
        status: 'published',
        ticketTypes: {
          create: [
            {
              name: 'General Admission',
              description: 'Standard Entry',
              price: ed.type === 'INTERNAL' ? 100 : 250,
              quantityTotal: 500,
              quantityRemaining: 500,
              priceDisplay: ed.type === 'INTERNAL' ? '100 SEK' : '250 SEK',

            },
            {
              name: 'VIP',
              description: 'VIP Entry',
              price: 500,
              quantityTotal: 50,
              quantityRemaining: 50,
              priceDisplay: '500 SEK',

            }
          ]
        }
      }
    });
  }
  console.log(`✅ Created 5 more events with ticket types`);

  // 4. Create some posts
  console.log('📝 Creating posts...');
  await prisma.post.create({
    data: {
      body: 'Welcome to the new semester! We have a lot of exciting events planned.',
      postType: 'text',
      schoolId: hostSchool.id,
      authorId: schoolAdmin.id,
    }
  });

  await prisma.post.create({
    data: {
      body: 'Who is excited for the Winter Gala?',
      postType: 'text',
      schoolId: hostSchool.id,
      authorId: student.id,
    }
  });
  console.log(`✅ Created sample posts`);

  // 5. Create some dummy tickets for the new students
  console.log('🎫 Issuing tickets to new students...');
  const latestEvent = await prisma.event.findFirst({ 
    where: { title: 'Winter Gala' },
    include: { ticketTypes: true }
  });

  if (latestEvent) {
    const generalTicket = latestEvent.ticketTypes.find(t => t.name === 'General Admission');
    if (generalTicket) {
      let count = 0;
      for (const s of newStudents) {
        if (count >= 5) break; // Issue to 5 students
        await prisma.ticket.create({
          data: {
            userId: s.id,
            eventId: latestEvent.id,
            ticketTypeId: generalTicket.id,
            code: `TK-${uuidv4().substring(0, 8).toUpperCase()}`,
            qrToken: `QR-${uuidv4().substring(0, 16).toUpperCase()}`,
            status: 'ISSUED',
          }
        });
        await prisma.ticketType.update({
          where: { id: generalTicket.id },
          data: { quantityRemaining: { decrement: 1 } }
        });
        count++;
      }
      console.log(`✅ Issued 5 tickets for Winter Gala`);
    }
  }

  console.log('✨ More data successfully added!');
}

main()
  .catch((e) => {
    console.error('❌ Error adding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
