const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with dummy data...');

  const plainPasswordSuperAdmin = 'SuperAdmin123!';
  const plainPasswordSchoolAdmin = 'SchoolAdmin123!';
  const plainPasswordStudent = 'Student123!';

  const hashedSuperAdmin = await bcrypt.hash(plainPasswordSuperAdmin, 10);
  const hashedSchoolAdmin = await bcrypt.hash(plainPasswordSchoolAdmin, 10);
  const hashedStudent = await bcrypt.hash(plainPasswordStudent, 10);

  // 1. Create Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@tikit.com',
      username: 'superadmin',
      displayName: 'Super Administrator',
      password: hashedSuperAdmin,
      role: 'TIKIT_ADMIN',
      accountStatus: 'ACTIVE',
      approvalStatus: 'approved',
      isVerified: true,
    },
  });
  console.log('✅ Super Admin created');

  // 2. Create School
  const school = await prisma.school.create({
    data: {
      name: 'Tikit High School',
      slug: 'tikit-high',
      city: 'Stockholm',
      schoolCode: 'TIKITHIGH2025',
      isActive: true,
      isVerified: true,
      cardLimit: 10,
    },
  });
  console.log('✅ School created');

  // 3. Create School Admin
  const schoolAdmin = await prisma.user.create({
    data: {
      email: 'admin@tikithigh.com',
      username: 'tikithigh_admin',
      displayName: 'Tikit High Admin',
      password: hashedSchoolAdmin,
      role: 'SCHOOL_ADMIN',
      accountStatus: 'ACTIVE',
      approvalStatus: 'approved',
      isVerified: true,
      schoolId: school.id,
    },
  });
  console.log('✅ School Admin created');

  // 4. Create Students
  const student1 = await prisma.user.create({
    data: {
      email: 'student1@tikithigh.com',
      username: 'student_one',
      displayName: 'Student One',
      password: hashedStudent,
      role: 'STUDENT',
      accountStatus: 'ACTIVE',
      approvalStatus: 'approved',
      isVerified: true,
      schoolId: school.id,
      className: 'Class of 2025',
    },
  });

  const student2 = await prisma.user.create({
    data: {
      email: 'student2@tikithigh.com',
      username: 'student_two',
      displayName: 'Student Two',
      password: hashedStudent,
      role: 'STUDENT',
      accountStatus: 'ACTIVE',
      approvalStatus: 'approved',
      isVerified: true,
      schoolId: school.id,
      className: 'Class of 2026',
    },
  });
  console.log('✅ Students created');

  // 5. Create a Card
  const card = await prisma.card.create({
    data: {
      title: 'Premium Student Card',
      schoolId: school.id,
      description: 'Access to all school events',
      validFrom: new Date(),
      validUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      status: 'active',
      codeGenerationType: 'individual',
      benefits: ['Free entry to parties', 'Cafeteria discount'],
    },
  });
  
  await prisma.cardCode.create({
    data: {
      cardId: card.id,
      code: 'TEST-CARD-1234',
      isUsed: false,
    },
  });
  console.log('✅ Card created');

  // 6. Create Events
  const internalEvent = await prisma.event.create({
    data: {
      title: 'Tikit High Winter Ball',
      description: 'The annual winter ball for Tikit High students.',
      eventType: 'INTERNAL',
      schoolId: school.id,
      startsAt: new Date(new Date().getTime() + 86400000 * 7), // 7 days from now
      endsAt: new Date(new Date().getTime() + 86400000 * 7 + 14400000), // + 4 hours
      status: 'published',
      isPublished: true,
      venueName: 'Main Hall',
    },
  });

  const externalEvent = await prisma.event.create({
    data: {
      title: 'City Wide Music Festival',
      description: 'External festival open to everyone.',
      eventType: 'EXTERNAL',
      schoolId: school.id,
      startsAt: new Date(new Date().getTime() + 86400000 * 14), // 14 days from now
      endsAt: new Date(new Date().getTime() + 86400000 * 14 + 28800000), // + 8 hours
      status: 'published',
      isPublished: true,
      venueName: 'City Park',
      externalBuyUrl: 'https://tickets.com/music-fest',
      externalPriceDisplay: '$25.00',
    },
  });
  console.log('✅ Events created');

  // 7. Create Post and Poll
  const post = await prisma.post.create({
    data: {
      body: 'What theme should we have for the next school party?',
      postType: 'poll',
      schoolId: school.id,
      authorId: student1.id,
      isPublished: true,
    },
  });

  await prisma.pollOption.createMany({
    data: [
      { postId: post.id, text: 'Neon 80s' },
      { postId: post.id, text: 'Masquerade' },
      { postId: post.id, text: 'Hollywood Glamour' },
    ],
  });
  console.log('✅ Post and Poll created');

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
