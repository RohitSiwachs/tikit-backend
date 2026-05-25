import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  LoginDto,
  RegisterDto,
  SendOtpDto,
  VerifyOtpDto,
  VerifySchoolDto,
} from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  role: true,
  schoolId: true,
  school: { select: { id: true, name: true, city: true, logoUrl: true } },
  avatarUrl: true,
  isVerified: true,
  approvalStatus: true,
  phone: true,
  firstName: true,
  lastName: true,
  biography: true,
  interests: true,
  expoPushToken: true,
  notifPush: true,
  notifEmail: true,
  notifSms: true,
  notifFriendRequests: true,
  notifNewPosts: true,
  notifEventInvites: true,
  notifTicketReceipts: true,
  theme: true,
  language: true,
  isPrivateAccount: true,
  isVisibleToOtherSchools: true,
  createdAt: true,
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  private buildTokenPayload(user: { id: string; email: string; role: string; schoolId: string | null }) {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    };
  }

  private async issueTokenPair(userId: string, email: string, role: string, schoolId: string | null) {
    const payload = this.buildTokenPayload({ id: userId, email, role, schoolId });
    const accessToken = this.jwtService.sign(payload);

    // Refresh token — opaque random string stored in DB
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshExpiryDays = parseInt(
      this.config.get<string>('JWT_REFRESH_EXPIRATION_DAYS') || '30',
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshExpiryDays);

    await this.prisma.refreshToken.create({
      data: { userId, token: rawRefreshToken, expiresAt },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { school: { select: { id: true, name: true, city: true, logoUrl: true } } },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role, user.schoolId);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        schoolId: user.schoolId,
        school: user.school,
        isVerified: user.isVerified,
        approvalStatus: user.approvalStatus,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async register(dto: RegisterDto) {
    const { schoolCode, password, ...userData } = dto;

    const school = await this.prisma.school.findUnique({ where: { schoolCode } });
    if (!school) throw new BadRequestException('Invalid school code');

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) throw new BadRequestException('Email or username already taken');

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        schoolId: school.id,
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        approvalStatus: 'pending',
      },
      select: SAFE_USER_SELECT,
    });

    return user;
  }

  async refresh(rawRefreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: rawRefreshToken },
      include: { user: { select: { id: true, email: true, role: true, schoolId: true, deletedAt: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (stored.user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists');
    }

    // Rotate — revoke old, issue new pair
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokenPair(
      stored.user.id,
      stored.user.email,
      stored.user.role,
      stored.user.schoolId,
    );

    return { access_token: tokens.accessToken, refresh_token: tokens.refreshToken };
  }

  async logout(rawRefreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: rawRefreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  async verifySchool(dto: VerifySchoolDto) {
    const school = await this.prisma.school.findUnique({
      where: { schoolCode: dto.schoolCode },
      select: { id: true, name: true, city: true, logoUrl: true, coverUrl: true, schoolCode: true },
    });
    if (!school) throw new BadRequestException('Invalid school code');
    return school;
  }

  async sendOtp(dto: SendOtpDto) {
    // Non-enumerable error — don't reveal whether userId exists
    let user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new BadRequestException('OTP request failed');

    if (dto.phone) {
      user = await this.prisma.user.update({
        where: { id: dto.userId },
        data: { phone: dto.phone },
      });
    }

    if (user.isVerified) throw new BadRequestException('User already verified');

    const otpPlain = crypto.randomInt(100000, 999999).toString();
    // Store as bcrypt hash — never persist plaintext OTP
    const otpHash = await bcrypt.hash(otpPlain, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode: otpHash, otpExpiresAt },
    });

    const elksUsername = process.env.ELKS_USERNAME;
    const elksPassword = process.env.ELKS_PASSWORD;

    if (elksUsername && elksPassword && user.phone) {
      try {
        const auth = Buffer.from(`${elksUsername}:${elksPassword}`).toString('base64');
        const body = new URLSearchParams({
          from: 'TiKit',
          to: user.phone,
          message: `Your TiKit verification code is: ${otpPlain}`,
        });
        const response = await fetch('https://api.46elks.com/a1/SMS', {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        if (!response.ok) {
          console.error('[46elks] SMS send failed:', await response.text());
        }
      } catch (err) {
        console.error('[46elks] Error:', err);
      }
    } else {
      // Development-only fallback — never logs actual OTP to avoid leaking to logs
      console.log(`[Dev] OTP generated for userId ${user.id} — check console only in local dev`);
      // In CI/dev environments the OTP is logged intentionally:
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Dev OTP] ${otpPlain}`);
      }
    }

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.isVerified) throw new BadRequestException('User already verified');
    if (!user.otpCode) throw new BadRequestException('No OTP requested');
    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP expired');
    }

    const otpMatch = await bcrypt.compare(dto.otpCode, user.otpCode);
    if (!otpMatch) throw new BadRequestException('Invalid OTP');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, otpCode: null, otpExpiresAt: null },
    });

    return { message: 'Phone verified successfully' };
  }
}
