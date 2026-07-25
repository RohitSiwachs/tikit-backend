const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting multi-school post test ---');

  // 1. Create 2 test schools
  const schoolA = await prisma.school.create({
    data: { name: 'Test School A', slug: `test-school-a-${Date.now()}`, city: 'Test City', schoolCode: `SA${Date.now()}` }
  });
  const schoolB = await prisma.school.create({
    data: { name: 'Test School B', slug: `test-school-b-${Date.now()}`, city: 'Test City', schoolCode: `SB${Date.now()}` }
  });
  console.log('Created schools:', schoolA.id, schoolB.id);

  // 2. Create a test admin in School A
  const admin = await prisma.user.create({
    data: {
      email: `admin-${Date.now()}@schoola.com`,
      username: `adminA-${Date.now()}`,
      displayName: 'Admin A',
      password: 'hash',
      role: 'TIKIT_ADMIN',
      schoolId: schoolA.id,
    }
  });

  // 3. Create a post targeting School A and connecting School B
  let post;
  try {
    post = await prisma.post.create({
      data: {
        postType: 'text',
        body: 'Hello multi-school world!',
        schoolId: schoolA.id,
        authorId: admin.id,
        connectedSchools: {
          connect: [{ id: schoolB.id }]
        }
      }
    });
    console.log('Created Post with connectedSchools:', post.id);
  } catch (error) {
    console.error('\n? Prisma Client Error: Your Prisma client is likely outdated.');
    console.error('Please stop your backend server (npm run start:dev) and run:');
    console.error('npx prisma generate');
    console.error('Then restart your server and try running this test again.\n');
    console.error(error.message);
    throw new Error('Test aborted due to Prisma client issue');
  }

  // 4. Test if School B can see it in their feed query (simulating getFeed logic)
  const schoolBFeed = await prisma.post.findMany({
    where: {
      deletedAt: null,
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
      AND: [
        {
          OR: [
            { schoolId: schoolB.id },
            { connectedSchools: { some: { id: schoolB.id } } },
            { event: { schoolId: schoolB.id } },
            { event: { connectedSchools: { some: { id: schoolB.id } } } },
          ],
        },
      ],
    },
  });

  console.log(`\nFeed for School B has ${schoolBFeed.length} posts matching.`);
  const found = schoolBFeed.find(p => p.id === post.id);
  if (found) {
    console.log('? TEST PASSED: School B feed successfully fetches the post via connectedSchools!');
  } else {
    console.error('? TEST FAILED: Post not found in School B feed.');
  }

  // Cleanup
  console.log('\nCleaning up test data...');
  await prisma.post.deleteMany({ where: { id: post.id } });
  await prisma.user.deleteMany({ where: { id: admin.id } });
  await prisma.school.deleteMany({ where: { id: { in: [schoolA.id, schoolB.id] } } });
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
