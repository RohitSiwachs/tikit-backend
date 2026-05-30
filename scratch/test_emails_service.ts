import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmailsService } from '../src/emails/emails.service';

async function bootstrap() {
  console.log('Bootstrapping testing application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('App context initialized successfully!');

  const emailsService = app.get(EmailsService);

  console.log('\n--- 1. Testing sendWelcomeEmail ---');
  await emailsService.sendWelcomeEmail('rohitsiwachs1999@gmail.com', 'Rohit Siwach');

  console.log('\n--- 2. Testing sendTicketReceiptEmail ---');
  await emailsService.sendTicketReceiptEmail(
    'rohitsiwachs1999@gmail.com',
    'Rohit Siwach',
    'Grand Student Gala 2026',
    'TK-88FF99',
  );

  console.log('\nClosing application context...');
  await app.close();
  console.log('Done!');
}

bootstrap().catch((err) => {
  console.error('Test script crashed:', err);
});
