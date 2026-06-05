const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('1. Fetching a school...');
  const school = await prisma.school.findFirst();
  
  if (!school) {
    console.log('No schools found.');
    return;
  }
  
  console.log(`Using school: ${school.name} (${school.id})`);

  console.log('2. Creating or updating student rohitsiwachs1999@gmail.com...');
  const email = 'rohitsiwachs1999@gmail.com';
  const hashedPassword = await bcrypt.hash('rohit@1999', 12);
  
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    user = await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        schoolId: school.id,
        className: 'Demo Class 2026',
        role: 'STUDENT',
        deletedAt: null
      }
    });
  } else {
    user = await prisma.user.create({
      data: {
        email,
        username: 'rohitsiwachs1999',
        displayName: 'Rohit Siwach',
        password: hashedPassword,
        schoolId: school.id,
        className: 'Demo Class 2026',
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        isVerified: true,
        approvalStatus: 'approved'
      }
    });
  }

  console.log(`Student created/updated. ID: ${user.id}`);

  console.log('3. Creating a dummy Card...');
  const card = await prisma.card.create({
    data: {
      title: 'Premium Student Pass',
      schoolId: school.id,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      status: 'published'
    }
  });

  console.log(`Card created. ID: ${card.id}`);

  const adminEmail = 'tempadmin2@tikit.se';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        username: 'tempadmin2',
        displayName: 'Temp Admin',
        password: hashedPassword, // rohit@1999
        schoolId: school.id,
        role: 'TIKIT_ADMIN',
        accountStatus: 'ACTIVE',
        isVerified: true,
        approvalStatus: 'approved'
      }
    });
  }

  console.log('4. Logging in as Admin...');
  const loginRes = await fetch('http://localhost:3000/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: 'rohit@1999' })
  });

  if (!loginRes.ok) {
    console.error('Failed to login as admin:', await loginRes.text());
    return;
  }

  const loginData = await loginRes.json();
  const accessToken = loginData.tokens.accessToken; // FIX: correct destructuring

  console.log('5. Calling Assign Cards API...');
  const assignRes = await fetch(`http://localhost:3000/v1/schools/${school.id}/assign-cards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      cardId: card.id,
      classNames: ['Demo Class 2026']
    })
  });

  if (!assignRes.ok) {
    console.error('Failed to assign card:', await assignRes.text());
    return;
  }

  const result = await assignRes.json();
  console.log('✅ API Response:', result);
  console.log('🎉 Done! Please check rohitsiwachs1999@gmail.com inbox for the Card Assignment email.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
