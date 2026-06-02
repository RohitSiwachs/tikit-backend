import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function bootstrap() {
  console.log('🚀 Initializing NestJS App Context for Push Test...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });

  const prisma = app.get(PrismaService);
  const notificationsService = app.get(NotificationsService);

  console.log('\n👤 1. Seeding a fake Expo Push Token for demostudent@gmail.com...');
  // Expo requires tokens to match a specific format to be valid
  const fakeToken = 'ExponentPushToken[1234567890123456789012]';
  
  const user = await prisma.user.update({
    where: { email: 'demostudent@gmail.com' },
    data: { expoPushToken: fakeToken, notifPush: true },
  });
  console.log(`✅ User ${user.email} updated with token: ${user.expoPushToken}`);

  console.log('\n📨 2. Triggering Push Notification via BullMQ...');
  const result = await notificationsService.sendToSegment({
    title: 'Testing Redis + BullMQ! 🚀',
    body: 'If you see this in the logs, it successfully went through the Redis queue!',
    segmentFilters: {}, // Target everyone (but only those with a token will receive it)
  });

  console.log('✅ sendToSegment returned:', result);

  console.log('\n⏳ 3. Waiting 5 seconds to let the BullMQ Processor consume the job from Redis...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n✅ Test complete! Closing app context.');
  await app.close();
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
