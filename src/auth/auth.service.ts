import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, RegisterDto, SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { school: true },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        school: user.school,
        isVerified: user.isVerified,
      },
    };
  }

  async register(dto: RegisterDto) {
    const { schoolCode, password, ...userData } = dto;

    // Validate school code
    const school = await this.prisma.school.findUnique({
      where: { schoolCode },
    });

    if (!school) {
      throw new BadRequestException('Invalid school code');
    }

    // Check if user exists
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });

    if (existing) {
      throw new BadRequestException('Email or username already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        schoolId: school.id,
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        approvalStatus: 'pending',
      },
    });

    // Optionally send OTP right after creation
    // await this.sendOtp({ userId: user.id });
    
    return user;
  }

  async sendOtp(dto: SendOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.isVerified) {
      throw new BadRequestException('User already verified');
    }

    // Generate a 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode, otpExpiresAt },
    });

    const elksUsername = process.env.ELKS_USERNAME;
    const elksPassword = process.env.ELKS_PASSWORD;

    if (elksUsername && elksPassword && user.phone) {
      try {
        const auth = Buffer.from(`${elksUsername}:${elksPassword}`).toString('base64');
        const data = new URLSearchParams();
        data.append('from', 'TiKit'); // Max 11 alphanumeric characters
        data.append('to', user.phone); 
        data.append('message', `Your TiKit verification code is: ${otpCode}`);

        const response = await fetch('https://api.46elks.com/a1/SMS', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: data
        });

        if (!response.ok) {
          const errorResult = await response.text();
          console.error('[46elks] Failed to send SMS:', errorResult);
          // Fallback to console if failed
          console.log(`[Mock SMS/Email] Sending OTP ${otpCode} to user phone: ${user.phone} / email: ${user.email}`);
        } else {
          console.log(`[46elks] SMS sent successfully to ${user.phone}`);
        }
      } catch (error) {
        console.error('[46elks] Error sending SMS:', error);
        // Fallback
        console.log(`[Mock SMS/Email] Sending OTP ${otpCode} to user phone: ${user.phone} / email: ${user.email}`);
      }
    } else {
      // Mock sending OTP
      console.log(`[Mock SMS/Email] Sending OTP ${otpCode} to user phone: ${user.phone} / email: ${user.email}`);
    }

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.isVerified) {
      throw new BadRequestException('User already verified');
    }
    if (!user.otpCode || user.otpCode !== dto.otpCode) {
      throw new BadRequestException('Invalid OTP');
    }
    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP expired');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { 
        isVerified: true, 
        otpCode: null, 
        otpExpiresAt: null,
      },
    });

    return { message: 'Phone verified successfully' };
  }
}
