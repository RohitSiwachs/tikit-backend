import { Module } from '@nestjs/common';
import { SMS_SERVICE } from './sms.interface';
import { MockSmsService } from './mock-sms.service';
import { HelloSmsService } from './hello-sms.service';

@Module({
  providers: [
    {
      provide: SMS_SERVICE,
      useFactory: () => {
        const provider = (process.env.SMS_PROVIDER || 'mock').toLowerCase();
        switch (provider) {
          case 'hellosms':
            return new HelloSmsService();
          case 'mock':
          default:
            return new MockSmsService();
        }
      },
    },
  ],
  exports: [SMS_SERVICE],
})
export class SmsModule {}
