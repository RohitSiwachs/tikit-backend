import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SchoolsService } from '../src/schools/schools.service';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  console.log('Bootstrapping NestJS...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const schoolsService = app.get(SchoolsService);

  console.log('1. Fetching a school...');
  const school = await prisma.school.findFirst();
  
  if (!school) {
    console.log('No schools found.');
    await app.close();
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
        isVerified: true
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

  console.log('4. Triggering the assignCards Service directly...');
  try {
    const result = await schoolsService.assignCards(school.id, card.id, ['Demo Class 2026']);
    console.log('✅ Service Response:', result);
    console.log('Waiting 3 seconds for async email promises to resolve...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('🎉 Done! Please check rohitsiwachs1999@gmail.com inbox for the Card Assignment email.');
  } catch (error) {
    console.error('Failed to assign card:', error);
  }

  await app.close();
}

bootstrap().catch(console.error);
