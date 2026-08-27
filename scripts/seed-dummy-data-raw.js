const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

/** Generates a DDD-DDD-DDD-DDD numeric code (matches production format). */
function generateCode() {
  let digits = '';
  for (let i = 0; i < 12; i++) {
    digits += Math.floor(Math.random() * 10).toString();
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9, 12)}`;
}

async function main() {
  console.log('🌱 Seeding database with a massive amount of dummy data via raw SQL...');

  const hashedSuperAdmin = await bcrypt.hash('SuperAdmin123!', 10);
  const hashedSchoolAdmin = await bcrypt.hash('SchoolAdmin123!', 10);
  const hashedStudent = await bcrypt.hash('Student123!', 10);

  // Helper for generating multiple values
  const generateValues = (count, generatorFn) => {
    return Array.from({ length: count }).map(generatorFn);
  };

  try {
    // ==========================================
    // 1. SUPER ADMIN
    // ==========================================
    const superAdminId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "User" (id, email, username, "displayName", password, role, "accountStatus", "approvalStatus", "isVerified")
      VALUES ('${superAdminId}', 'superadmin@tikit.com', 'superadmin', 'Super Administrator', '${hashedSuperAdmin}', 'TIKIT_ADMIN', 'ACTIVE', 'approved', true);
    `);
    console.log('✅ Super Admin created');

    // ==========================================
    // 2. SCHOOLS & ADMINS
    // ==========================================
    const schoolData = [
      { id: crypto.randomUUID(), name: 'Tikit High School', slug: 'tikit-high', code: 'TIKITHIGH' },
      { id: crypto.randomUUID(), name: 'Global Academy', slug: 'global-academy', code: 'GLOBAL' },
      { id: crypto.randomUUID(), name: 'Nordic Institute', slug: 'nordic-institute', code: 'NORDIC' },
      { id: crypto.randomUUID(), name: 'City College', slug: 'city-college', code: 'CITYCOLLEGE' }
    ];

    for (let i = 0; i < schoolData.length; i++) {
      const s = schoolData[i];
      await prisma.$executeRawUnsafe(`
        INSERT INTO "School" (id, name, slug, city, "schoolCode", "isActive", "isVerified")
        VALUES ('${s.id}', '${s.name}', '${s.slug}', 'Stockholm', '${s.code}', true, true);
      `);

      const adminId = crypto.randomUUID();
      await prisma.$executeRawUnsafe(`
        INSERT INTO "User" (id, email, username, "displayName", password, role, "accountStatus", "approvalStatus", "isVerified", "schoolId")
        VALUES ('${adminId}', 'admin@${s.slug}.com', '${s.slug}_admin', '${s.name} Admin', '${hashedSchoolAdmin}', 'SCHOOL_ADMIN', 'ACTIVE', 'approved', true, '${s.id}');
      `);
    }
    console.log(`✅ ${schoolData.length} Schools and Admins created`);

    // ==========================================
    // 3. STUDENTS (30 per school)
    // ==========================================
    let studentCount = 0;
    const allStudentIds = [];

    for (const school of schoolData) {
      for (let j = 1; j <= 30; j++) {
        const studentId = crypto.randomUUID();
        allStudentIds.push({ id: studentId, schoolId: school.id });
        const username = `student_${school.slug.replace('-', '')}_${j}`;
        const email = `${username}@${school.slug}.com`;
        const className = `Class of ${2024 + (j % 4)}`;

        await prisma.$executeRawUnsafe(`
          INSERT INTO "User" (id, email, username, "displayName", password, role, "accountStatus", "approvalStatus", "isVerified", "schoolId", "className")
          VALUES ('${studentId}', '${email}', '${username}', 'Student ${j}', '${hashedStudent}', 'STUDENT', 'ACTIVE', 'approved', true, '${school.id}', '${className}');
        `);
        studentCount++;
      }
    }
    console.log(`✅ ${studentCount} Students created`);

    // ==========================================
    // 4. CARDS (3 per school)
    // ==========================================
    let cardCount = 0;
    for (const school of schoolData) {
      for (let c = 1; c <= 3; c++) {
        const cardId = crypto.randomUUID();
        const validFrom = `NOW() - interval '${Math.floor(Math.random() * 30)} days'`;
        const validUntil = `NOW() + interval '1 year'`;
        
        await prisma.$executeRawUnsafe(`
          INSERT INTO "Card" (id, title, "schoolId", description, benefits, "validFrom", "validUntil", status)
          VALUES ('${cardId}', '${school.name} Card Level ${c}', '${school.id}', 'Exclusive benefits for level ${c}', ARRAY['Benefit A', 'Benefit B'], ${validFrom}, ${validUntil}, 'active');
        `);

        // Generate 5 codes per card (each in DDD-DDD-DDD-DDD format)
        for (let codeIdx = 1; codeIdx <= 5; codeIdx++) {
          const cardCodeId = crypto.randomUUID();
          const cardCodeVal = generateCode();
          await prisma.$executeRawUnsafe(`
            INSERT INTO "CardCode" (id, "cardId", code, "isUsed")
            VALUES ('${cardCodeId}', '${cardId}', '${cardCodeVal}', false);
          `);
        }
        cardCount++;
      }
    }
    console.log(`✅ ${cardCount} Cards created (with codes)`);

    // ==========================================
    // 5. EVENTS (10 per school)
    // ==========================================
    let eventCount = 0;
    for (const school of schoolData) {
      for (let e = 1; e <= 10; e++) {
        const eventId = crypto.randomUUID();
        const isExternal = e % 3 === 0;
        const type = isExternal ? 'EXTERNAL' : 'INTERNAL';
        const startDays = (e - 2) * 5; // mix of past and future
        
        const startsAt = startDays < 0 ? `NOW() - interval '${Math.abs(startDays)} days'` : `NOW() + interval '${startDays} days'`;
        const endsAt = startDays < 0 ? `NOW() - interval '${Math.abs(startDays)} days' + interval '4 hours'` : `NOW() + interval '${startDays} days' + interval '4 hours'`;

        if (isExternal) {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "Event" (id, title, description, "eventType", "schoolId", "startsAt", "endsAt", status, "isPublished", "venueName", "externalBuyUrl", "externalPriceDisplay")
            VALUES ('${eventId}', '${school.name} Event ${e}', 'Description for event ${e}', 'EXTERNAL', '${school.id}', ${startsAt}, ${endsAt}, 'published', true, 'Venue ${e}', 'https://tickets.com/event-${e}', '$${10 + e}.00');
          `);
        } else {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "Event" (id, title, description, "eventType", "schoolId", "startsAt", "endsAt", status, "isPublished", "venueName")
            VALUES ('${eventId}', '${school.name} Event ${e}', 'Description for event ${e}', 'INTERNAL', '${school.id}', ${startsAt}, ${endsAt}, 'published', true, 'School Main Hall');
          `);
        }
        eventCount++;
      }
    }
    console.log(`✅ ${eventCount} Events created`);

    // ==========================================
    // 6. POSTS & POLLS (5 per school)
    // ==========================================
    let postCount = 0;
    for (const school of schoolData) {
      // Find students from this school
      const schoolStudents = allStudentIds.filter(s => s.schoolId === school.id);
      
      for (let p = 1; p <= 5; p++) {
        const postId = crypto.randomUUID();
        const authorId = schoolStudents[p % schoolStudents.length].id;
        const isPoll = p % 2 === 0;
        
        await prisma.$executeRawUnsafe(`
          INSERT INTO "Post" (id, body, "postType", "schoolId", "authorId")
          VALUES ('${postId}', 'Discussion topic ${p} for ${school.name}...', '${isPoll ? 'poll' : 'text'}', '${school.id}', '${authorId}');
        `);
        
        if (isPoll) {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "PollOption" (id, "postId", text)
            VALUES ('${crypto.randomUUID()}', '${postId}', 'Option A for Poll ${p}'),
                   ('${crypto.randomUUID()}', '${postId}', 'Option B for Poll ${p}'),
                   ('${crypto.randomUUID()}', '${postId}', 'Option C for Poll ${p}');
          `);
        }
        postCount++;
      }
    }
    console.log(`✅ ${postCount} Posts and Polls created`);

    console.log('🎉 MASSIVE Seeding complete!');
  } catch (e) {
    console.error('Error executing seed query:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
