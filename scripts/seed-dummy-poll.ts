import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting dummy poll seeding script...');

  // 1. Fetch any school
  let school = await prisma.school.findFirst();
  if (!school) {
    console.log('No schools found. Creating a default school "Polhem Gymnasieskola"...');
    school = await prisma.school.create({
      data: {
        name: 'Polhem Gymnasieskola',
        slug: 'polhem-gymnasieskola',
        city: 'Lund',
        schoolCode: 'PLH123',
        isVerified: true,
      },
    });
  }
  console.log(`Using school: ${school.name} (ID: ${school.id})`);

  // 2. Fetch or create a author (Admin / School Admin)
  let author = await prisma.user.findFirst({
    where: {
      role: { in: ['TIKIT_ADMIN', 'KARORDFORANDE'] },
    },
  });

  if (!author) {
    console.log('No admin user found. Creating a default admin user...');
    author = await prisma.user.create({
      data: {
        email: 'polhem.admin@tikit.se',
        displayName: 'Polhem Gymnasieskola',
        username: 'polhem_gymnasieskola',
        password: 'dummy-password-hash', // not used for test
        role: 'KARORDFORANDE',
        schoolId: school.id,
        approvalStatus: 'approved',
        isVerified: true,
      },
    });
  }
  console.log(`Using author: ${author.displayName} (ID: ${author.id}, Role: ${author.role})`);

  // 3. Fetch or create students to vote
  let students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    take: 15,
  });

  if (students.length < 5) {
    console.log('Not enough student users found. Creating 10 dummy students...');
    const dummyStudentsData = [
      { email: 'student1@tikit.se', displayName: 'Liam Johansson', username: 'liam_j' },
      { email: 'student2@tikit.se', displayName: 'Emma Andersson', username: 'emma_a' },
      { email: 'student3@tikit.se', displayName: 'Oliver Nilsson', username: 'oliver_n' },
      { email: 'student4@tikit.se', displayName: 'Sara Larsson', username: 'sara_l' },
      { email: 'student5@tikit.se', displayName: 'Lucas Persson', username: 'lucas_p' },
      { email: 'student6@tikit.se', displayName: 'Ella Karlson', username: 'ella_k' },
      { email: 'student7@tikit.se', displayName: 'Noah Hansen', username: 'noah_h' },
      { email: 'student8@tikit.se', displayName: 'Maja Berg', username: 'maja_b' },
      { email: 'student9@tikit.se', displayName: 'Filip Sand', username: 'filip_s' },
      { email: 'student10@tikit.se', displayName: 'Linnéa Ek', username: 'linnea_e' },
    ];

    for (const data of dummyStudentsData) {
      const student = await prisma.user.upsert({
        where: { email: data.email },
        update: {},
        create: {
          ...data,
          password: 'dummy-password-hash',
          role: 'STUDENT',
          schoolId: school.id,
          approvalStatus: 'approved',
          isVerified: true,
        },
      });
      students.push(student);
    }
  }
  console.log(`Using ${students.length} student voters.`);

  // 4. Create the poll post
  const pollExpiresAt = new Date();
  pollExpiresAt.setDate(pollExpiresAt.getDate() + 7); // 7 days from now

  const pollPost = await prisma.post.create({
    data: {
      body: 'Vilken artist vill ni ha på insparken?',
      postType: 'poll',
      schoolId: school.id,
      authorId: author.id,
      pollExpiresAt,
      pollOptions: {
        create: [
          { text: 'Håkan Hellström' },
          { text: 'Veronica Maggio' },
          { text: 'Mares' },
        ],
      },
    },
    include: {
      pollOptions: true,
    },
  });
  console.log(`\n✅ Created Poll Post: "${pollPost.body}"`);
  console.log(`Options created:`);
  pollPost.pollOptions.forEach((opt) => console.log(`  - [${opt.id}] ${opt.text}`));

  // 5. Seed Votes
  console.log('\n🗳 Seeding student votes...');
  let voteCount = 0;
  for (const student of students) {
    // Randomly select one of the three options
    const randomIndex = Math.floor(Math.random() * pollPost.pollOptions.length);
    const selectedOption = pollPost.pollOptions[randomIndex];

    try {
      await prisma.pollVote.create({
        data: {
          postId: pollPost.id,
          userId: student.id,
          optionId: selectedOption.id,
        },
      });
      voteCount++;
    } catch (err) {
      console.log(`Skipped vote for student ${student.displayName} (already voted or error)`);
    }
  }
  console.log(`✅ Seeded ${voteCount} votes successfully.`);

  // 6. Query and display the final seeded poll results
  const finalPost = await prisma.post.findUnique({
    where: { id: pollPost.id },
    include: {
      pollOptions: {
        include: {
          _count: { select: { votes: true } },
        },
      },
    },
  });

  if (finalPost) {
    const totalVotes = finalPost.pollOptions.reduce(
      (sum, opt) => sum + (opt._count?.votes || 0),
      0,
    );
    console.log('\n📊 SEEDED POLL RESULTS:');
    console.log(`Question: ${finalPost.body}`);
    console.log(`Total Votes: ${totalVotes}`);
    finalPost.pollOptions.forEach((opt) => {
      const votes = opt._count?.votes || 0;
      const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      console.log(`  * ${opt.text}: ${votes} votes (${pct}%)`);
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
