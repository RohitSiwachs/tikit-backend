import { Injectable, Logger } from '@nestjs/common';
import { ISmsService } from './sms.interface';

// Placeholder — implement when HelloSMS credentials are available
@Injectable()
export class HelloSmsService implements ISmsService {
  private readonly logger = new Logger(HelloSmsService.name);

  async sendOtp(phone: string, _otp: string): Promise<void> {
    this.logger.warn(
      `HelloSmsService is not yet implemented. OTP not sent to ${phone}.`,
    );
    throw new Error(
      'HelloSmsService is not yet implemented. Set SMS_PROVIDER=mock or provide HelloSMS credentials.',
    );
  }
}
