import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, SendOtpDto, VerifyOtpDto, VerifySchoolDto } from './dto/auth.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Strict rate limits on auth endpoints ───────────────────────────────────

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login')
  @ApiOperation({ summary: 'Login and get JWT access + refresh token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new student' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('verify-school')
  @ApiOperation({ summary: 'Verify school code and retrieve school details' })
  verifySchool(@Body() dto: VerifySchoolDto) {
    return this.authService.verifySchool(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 300000, limit: 3 } })
  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP for phone verification (3 per 5 minutes)' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP for phone verification' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh token and log out' })
  logout(@Body('refresh_token') refreshToken: string) {
    return this.authService.logout(refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
  }
}
