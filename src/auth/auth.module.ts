import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const privateKey = config.get<string>('jwt.privateKey');
        const publicKey = config.get<string>('jwt.publicKey');
        console.log('JWT Key Length:', privateKey?.length, publicKey?.length);
        return {
          secret: privateKey,
          privateKey: privateKey,
          publicKey: publicKey,
          signOptions: {
            expiresIn: config.get<string>('jwt.accessExpiration') || '15m',
            algorithm: 'RS256',
          } as any,
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
