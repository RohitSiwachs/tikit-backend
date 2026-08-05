import { Controller, Post, Get, Body, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  SendOtpDto,
  VerifyOtpDto,
  VerifySchoolDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import {
  VerifyCurrentEmailOtpDto,
  SetNewEmailDto,
  ConfirmNewEmailOtpDto,
} from './dto/email-change.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 10 } }) // 10 attempts per 5 min per IP
  @Post('login')
  @ApiOperation({ summary: 'Login — returns access + refresh token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 3_600_000, limit: 5 } }) // 5 registrations per hour per IP
  @Post('register')
  @ApiOperation({ summary: 'Register a new student account' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('verify-school')
  @ApiOperation({ summary: 'Validate a school code and return school details' })
  verifySchool(@Body() dto: VerifySchoolDto) {
    return this.authService.verifySchool(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 10 } }) // 10 per 5 min per IP (userId cooldown in service)
  @Post('send-otp')
  @ApiOperation({ summary: 'Send phone verification OTP' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 10 } }) // Max 10 verify attempts per 5 min per IP
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify phone OTP' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('refresh')
  @ApiOperation({
    summary: 'Rotate refresh token — returns new access + refresh token',
  })
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh token' })
  logout(@Body('refresh_token') refreshToken: string) {
    return this.authService.logout(refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
  }

  // ─── Password Reset ──────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { ttl: 900_000, limit: 3 } }) // 3 reset requests per 15 min per IP
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 900_000, limit: 5 } }) // 5 reset attempts per 15 min per IP
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using the emailed token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ─── Email Change ───────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 3 } }) // 3 requests per minute per IP
  @Post('email-change/request')
  @ApiOperation({
    summary:
      'Step 1 — Request email change: sends OTP to the current email address',
  })
  requestEmailChange(@Request() req: any) {
    return this.authService.requestEmailChange(req.user.id);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 300_000, limit: 10 } }) // 10 attempts per 5 min per IP
  @Post('email-change/verify-current')
  @ApiOperation({
    summary:
      'Step 2 — Verify OTP from current email: returns a changeToken for next steps',
  })
  verifyCurrentEmailOtp(
    @Request() req: any,
    @Body() dto: VerifyCurrentEmailOtpDto,
  ) {
    return this.authService.verifyCurrentEmailOtp(req.user.id, dto);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 300_000, limit: 5 } }) // 5 attempts per 5 min per IP
  @Post('email-change/set-new')
  @ApiOperation({
    summary:
      'Step 3 — Submit new email address: sends OTP to the new email (requires changeToken)',
  })
  setNewEmail(@Request() req: any, @Body() dto: SetNewEmailDto) {
    return this.authService.setNewEmail(req.user.id, dto);
  }

  @ApiBearerAuth()
  @Throttle({ default: { ttl: 300_000, limit: 10 } }) // 10 attempts per 5 min per IP
  @Post('email-change/confirm')
  @ApiOperation({
    summary:
      'Step 4 — Confirm new email OTP: updates email and revokes all sessions',
  })
  confirmNewEmail(@Request() req: any, @Body() dto: ConfirmNewEmailOtpDto) {
    return this.authService.confirmNewEmail(req.user.id, dto);
  }
}
