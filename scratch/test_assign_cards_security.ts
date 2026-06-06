import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { CardsService } from '../src/cards/cards.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function bootstrap() {
  console.log('Bootstrapping testing module...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const usersService = app.get(UsersService);
  const cardsService = app.get(CardsService);

  try {
    // 1. Get two different schools
    const schools = await prisma.school.findMany({ take: 2 });
    if (schools.length < 2) {
      console.log('Need at least 2 schools to test mismatch. Aborting.');
      return;
    }
    const schoolA = schools[0];
    const schoolB = schools[1];

    console.log(`School A: ${schoolA.name}`);
    console.log(`School B: ${schoolB.name}`);

    // 2. Create a card for School A
    const card = await prisma.card.create({
      data: {
        title: 'Security Test Card',
        schoolId: schoolA.id,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 86400000),
      }
    });
    console.log(`Created Card for School A: ${card.id}`);

    // 3. Create a user for School B
    const userB = await prisma.user.create({
      data: {
        email: `test_user_b_${Date.now()}@test.com`,
        username: `test_user_b_${Date.now()}`,
        displayName: 'Test User B',
        password: 'Password123',
        schoolId: schoolB.id,
        role: 'STUDENT',
      }
    });
    console.log(`Created User for School B: ${userB.id}`);

    // 4. Create a user with NO school
    const userNull = await prisma.user.create({
      data: {
        email: `test_user_null_${Date.now()}@test.com`,
        username: `test_user_null_${Date.now()}`,
        displayName: 'Test User Null',
        password: 'Password123',
        role: 'STUDENT',
      }
    });
    console.log(`Created User with NO School: ${userNull.id}`);

    console.log('\n--- TEST 1: Admin assignCards mismatch ---');
    try {
      await usersService.assignCards(card.id, [userB.id]);
      console.log('❌ FAIL: assignCards succeeded but it should have failed!');
    } catch (err: any) {
      console.log('✅ PASS: assignCards failed correctly.', err.message);
    }

    console.log('\n--- TEST 2: Student claimCard mismatch (different school) ---');
    // Generate a code for the card first
    await cardsService.generateCodes(card.id, 1);
    const codeObj = await prisma.cardCode.findFirst({ where: { cardId: card.id } });
    
    try {
      await cardsService.claimCard(userB.id, codeObj!.code);
      console.log('❌ FAIL: claimCard succeeded for different school!');
    } catch (err: any) {
      console.log('✅ PASS: claimCard failed correctly.', err.message);
    }

    console.log('\n--- TEST 3: Student claimCard with NULL school ---');
    try {
      await cardsService.claimCard(userNull.id, codeObj!.code);
      console.log('❌ FAIL: claimCard succeeded for user with no school!');
    } catch (err: any) {
      console.log('✅ PASS: claimCard failed correctly for null school user.', err.message);
    }

    // Cleanup
    await prisma.cardCode.deleteMany({ where: { cardId: card.id } });
    await prisma.card.delete({ where: { id: card.id } });
    await prisma.user.deleteMany({ where: { id: { in: [userB.id, userNull.id] } } });
    
  } catch (err) {
    console.error('Test script encountered an error:', err);
  } finally {
    await app.close();
  }
}

bootstrap();
