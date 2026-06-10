import { Injectable, Logger } from '@nestjs/common';
import { ISmsService } from './sms.interface';

// Placeholder — implement when HelloSMS credentials are available
@Injectable()
export class HelloSmsService implements ISmsService {
  private readonly logger = new Logger(HelloSmsService.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    const username = process.env.HELLOSMS_USERNAME;
    const password = process.env.HELLOSMS_PASSWORD;

    if (!username || !password) {
      this.logger.error('HELLOSMS_USERNAME or HELLOSMS_PASSWORD is not configured');
      throw new Error('HelloSMS credentials are not configured');
    }

    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const message = `Your TiKit verification code is: ${otp}`;

    try {
      const response = await fetch('https://api.hellosms.se/v1/sms/send', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'HelloSMS.se',
          to: phone,
          message: message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`HelloSMS API failed: ${response.status} ${errorText}`);
        throw new Error('Failed to send SMS via HelloSMS');
      }

      const data = await response.json();
      this.logger.log(`HelloSMS send success: ${data.statusText}`);
    } catch (error) {
      this.logger.error(`Error calling HelloSMS: ${error.message}`);
      throw error;
    }
  }
}
