const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all schools...');
  const schools = await prisma.school.findMany();
  
  if (schools.length === 0) {
    console.log('No schools found in the database.');
    return;
  }

  console.log(`Found ${schools.length} schools. Adding demo classes...`);

  for (const school of schools) {
    // Check if demo class already exists
    const existing = await prisma.class.findFirst({
      where: { schoolId: school.id, className: 'Demo Class 2026' }
    });

    if (!existing) {
      await prisma.class.create({
        data: {
          schoolId: school.id,
          className: 'Demo Class 2026',
          graduationYear: 2026
        }
      });
      console.log(`✅ Created "Demo Class 2026" for school: ${school.name}`);
    } else {
      console.log(`ℹ️ "Demo Class 2026" already exists for school: ${school.name}`);
    }
  }

  // Now let's test the "getClasses" logic for the first school
  const targetSchool = schools[0];
  console.log(`\nTesting getClasses logic for school: ${targetSchool.name} (${targetSchool.id})`);
  
  const classes = await prisma.class.findMany({
    where: { schoolId: targetSchool.id },
    orderBy: { graduationYear: 'desc' },
  });

  const students = await prisma.user.findMany({
    where: {
      schoolId: targetSchool.id,
      className: { in: classes.map((c) => c.className) },
      role: 'STUDENT',
      deletedAt: null,
    },
    select: {
      id: true,
      displayName: true,
      className: true,
    },
  });

  const classData = classes.map((c) => {
    const classStudents = students.filter((s) => s.className === c.className);
    return {
      id: c.id,
      className: c.className,
      graduationYear: c.graduationYear,
      studentCount: classStudents.length,
      students: classStudents,
    };
  });

  console.log('\nResult of fetching classes with students:');
  console.log(JSON.stringify(classData, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
