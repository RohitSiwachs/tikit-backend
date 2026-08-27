const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function seedStudent() {
  try {
    let school = await prisma.school.findFirst({
      where: { name: { contains: 'test', mode: 'insensitive' } }
    });

    if (!school) {
      school = await prisma.school.findFirst();
    }

    if (!school) {
      console.log('Error: No school found.');
      return;
    }

    const randomNum = Math.floor(Math.random() * 1000);
    const email = `student${randomNum}@test.com`;
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        displayName: 'Simple Test Student',
        username: `student_${randomNum}`,
        role: 'STUDENT',
        school: { connect: { id: school.id } },
        approvalStatus: 'approved',
        isVerified: true
      }
    });

    console.log(`\n=== STUDENT SEEDED SUCCESSFULLY ===`);
    console.log(`School Assigned: ${school.name}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`User ID: ${user.id}`);
    console.log(`===================================\n`);

  } catch (error) {
    console.error('Error seeding student:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedStudent();
