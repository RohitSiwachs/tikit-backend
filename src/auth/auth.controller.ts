import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login and get JWT token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new student' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP for phone verification' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Public()
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP for phone verification' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }
}
