import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthCleanupService } from './auth.cleanup.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { EmailsModule } from '../emails/emails.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    PassportModule,
    EmailsModule,
    PrismaModule,
    SmsModule,

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.privateKey'),
        privateKey: config.get<string>('jwt.privateKey'),
        publicKey: config.get<string>('jwt.publicKey'),
        signOptions: {
          expiresIn: config.get<string>('jwt.accessExpiration') || '15m',
          algorithm: 'RS256',
        } as any,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthCleanupService],
  exports: [AuthService],
})
export class AuthModule {}
