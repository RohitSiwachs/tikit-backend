import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Generating extensive social and school data...');

  const pw = await bcrypt.hash('password123', 10);

  // 1. Create New Schools & School Admins
  console.log('🏫 Creating 3 new schools and their admins...');
  const newSchoolsData = [
    { name: 'KTH Royal Institute', slug: 'kth', city: 'Stockholm' },
    { name: 'Uppsala University', slug: 'uppsala', city: 'Uppsala' },
    { name: 'Lund University', slug: 'lund', city: 'Lund' }
  ];

  const createdSchools: any[] = [];
  const createdAdmins: any[] = [];
  
  for (const s of newSchoolsData) {
    const school = await prisma.school.create({
      data: {
        name: s.name,
        slug: s.slug,
        schoolCode: s.slug.toUpperCase() + '100',
        city: s.city,
        isVerified: true,
        isActive: true,
      }
    });
    createdSchools.push(school);

    const admin = await prisma.user.create({
      data: {
        email: `admin@${s.slug}.edu`,
        username: `${s.slug}_admin`,
        displayName: `${s.name} Admin`,
        password: pw,
        role: 'KARORDFORANDE',
        schoolId: school.id,
        isVerified: true,
        approvalStatus: 'approved',
      }
    });
    createdAdmins.push(admin);
  }
  console.log('✅ Schools and admins created.');

  // 2. Create Students for these schools
  console.log('👤 Creating students...');
  const allNewStudents: any[] = [];
  for (const school of createdSchools) {
    for (let i = 1; i <= 5; i++) {
      const student = await prisma.user.create({
        data: {
          email: `student${i}@${school.slug}.edu`,
          username: `${school.slug}_student_${i}`,
          displayName: `${school.name} Student ${i}`,
          password: pw,
          role: 'STUDENT',
          schoolId: school.id,
          isVerified: true,
          approvalStatus: 'approved',
          cardStatus: 'active',
        }
      });
      allNewStudents.push(student);
    }
  }
  console.log(`✅ Created ${allNewStudents.length} students.`);

  // 3. Create Events
  console.log('🎫 Creating events for new schools...');
  const allEvents: any[] = [];
  for (const school of createdSchools) {
    for (let i = 1; i <= 2; i++) {
      const event = await prisma.event.create({
        data: {
          title: `${school.name} Party ${i}`,
          description: `Awesome party at ${school.name}!`,
          eventType: 'INTERNAL',
          schoolId: school.id,
          venueName: 'Student Union',
          startsAt: new Date(Date.now() + i * 86400000 * 5),
          endsAt: new Date(Date.now() + i * 86400000 * 5 + 4 * 3600000),
          isPublished: true,
          status: 'published',
          ticketTypes: {
            create: [
              {
                name: 'Free Entry',
                price: 0,
                quantityTotal: 100,
                quantityRemaining: 100,
                freeForHostSchool: true,
              }
            ]
          }
        }
      });
      allEvents.push(event);
    }
  }
  console.log(`✅ Created ${allEvents.length} events.`);

  // 4. Create Posts
  console.log('📝 Creating posts...');
  const allPosts: any[] = [];
  for (const student of allNewStudents) {
    const post = await prisma.post.create({
      data: {
        body: `Hello from ${student.displayName}! Excited for the upcoming semester.`,
        postType: 'text',
        schoolId: student.schoolId!,
        authorId: student.id,
      }
    });
    allPosts.push(post);
  }
  console.log(`✅ Created ${allPosts.length} posts.`);

  // 5. Create Comments and Likes on Posts
  console.log('💬 Adding likes and comments...');
  let likeCount = 0;
  let commentCount = 0;
  for (const post of allPosts) {
    // 3 random students like each post
    const shuffled = [...allNewStudents].sort(() => 0.5 - Math.random());
    const likers = shuffled.slice(0, 3);
    
    for (const liker of likers) {
      await prisma.postLike.create({
        data: {
          postId: post.id,
          userId: liker.id,
        }
      });
      likeCount++;
    }

    // 2 random students comment on each post
    const commenters = shuffled.slice(3, 5);
    for (const commenter of commenters) {
      await prisma.postComment.create({
        data: {
          postId: post.id,
          authorId: commenter.id,
          body: `Great post! I totally agree, ${commenter.displayName}.`,
        }
      });
      commentCount++;
    }


  }
  console.log(`✅ Added ${likeCount} likes and ${commentCount} comments.`);

  // 6. Create User Follows (Friends)
  console.log('🤝 Creating user follows...');
  let followCount = 0;
  for (const student of allNewStudents) {
    // Each student follows 2 random students from their own school
    const schoolMates = allNewStudents.filter(s => s.schoolId === student.schoolId && s.id !== student.id);
    const toFollow = schoolMates.sort(() => 0.5 - Math.random()).slice(0, 2);

    for (const target of toFollow) {
      await prisma.followRequest.create({
        data: {
          senderId: student.id,
          receiverId: target.id,
          status: 'accepted',
        }
      });

      // Raw SQL to insert into implicit many-to-many (_UserFollows)
      await prisma.$executeRawUnsafe(`
        INSERT INTO "_UserFollows" ("A", "B")
        VALUES ('${student.id}', '${target.id}')
        ON CONFLICT DO NOTHING
      `);
      
      followCount++;
    }
  }
  console.log(`✅ Created ${followCount} follow relationships.`);

  console.log('✨ Extensive Social Data Successfully Added!');
}

main()
  .catch((e) => {
    console.error('❌ Error adding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
