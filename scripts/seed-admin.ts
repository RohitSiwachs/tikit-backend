import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Admin User...');

  // 1. Create a default School for admin
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

  // 2. Create / update the Super Admin with new credentials
  const hashedPassword = await bcrypt.hash('admin@123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {
      password: hashedPassword,
      role: 'TIKIT_ADMIN',
      accountStatus: 'ACTIVE',
      isVerified: true,
      approvalStatus: 'approved',
    },
    create: {
      email: 'admin@gmail.com',
      displayName: 'Super Admin',
      username: 'tikit_admin',
      password: hashedPassword,
      role: 'TIKIT_ADMIN',
      accountStatus: 'ACTIVE',
      schoolId: school.id,
      isVerified: true,
      approvalStatus: 'approved',
    },
  });

  console.log(`✅ Admin User ready: ${admin.email}`);
  console.log('\n🚀 Login credentials:');
  console.log('   Email    : admin@gmail.com');
  console.log('   Password : admin@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
