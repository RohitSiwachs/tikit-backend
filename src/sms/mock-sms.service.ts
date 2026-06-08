import { Injectable, Logger } from '@nestjs/common';
import { ISmsService } from './sms.interface';

@Injectable()
export class MockSmsService implements ISmsService {
  private readonly logger = new Logger(MockSmsService.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    this.logger.log(`[MOCK SMS]\nPhone: ${phone}\nOTP: ${otp}`);
  }
}
