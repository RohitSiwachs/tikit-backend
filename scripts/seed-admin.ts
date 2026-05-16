import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Admin User...');

  // 1. Create a School
  const school = await prisma.school.upsert({
    where: { slug: 'tikit-academy' },
    update: {},
    create: {
      name: 'TiKit Academy',
      slug: 'tikit-academy',
      city: 'Stockholm',
      schoolCode: 'TK123',
      isVerified: true,
    },
  });

  console.log(`✅ School created: ${school.name} (Code: ${school.schoolCode})`);

  // 2. Create a Super Admin
  const hashedPassword = await bcrypt.hash('adminpassword', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@tikit.com' },
    update: {},
    create: {
      email: 'admin@tikit.com',
      displayName: 'Super Admin',
      username: 'admin',
      password: hashedPassword,
      role: 'TIKIT_ADMIN',
      accountStatus: 'ACTIVE',
      schoolId: school.id,
      isVerified: true,
      approvalStatus: 'approved',
    },
  });

  console.log(`✅ Admin User created: ${admin.email}`);
  console.log('\n🚀 You can now login with:');
  console.log('Email: admin@tikit.com');
  console.log('Password: adminpassword');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
