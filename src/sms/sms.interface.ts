export const SMS_SERVICE = 'SMS_SERVICE';

export abstract class ISmsService {
  abstract sendOtp(phone: string, otp: string): Promise<void>;
}
