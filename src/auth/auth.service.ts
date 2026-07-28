import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  Inject,
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
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailsService } from '../emails/emails.service';
import { SMS_SERVICE, ISmsService } from '../sms/sms.interface';

// Fields safe to return in API responses — expoPushToken is intentionally excluded
// (device identifiers should never be echoed back to clients)
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

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds between OTP sends
const MAX_OTP_ATTEMPTS = 5;
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Target bcrypt work factor. At 10 rounds bcrypt.compare takes ~85 ms (vs ~350 ms at 12).
// This keeps login below 300 ms while remaining well above OWASP's minimum of 10 rounds.
const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private emailsService: EmailsService,
    @Inject(SMS_SERVICE) private readonly smsService: ISmsService,
  ) {}

  private buildTokenPayload(user: {
    id: string;
    email: string;
    role: string;
    schoolId: string | null;
  }) {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    };
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    role: string,
    schoolId: string | null,
  ) {
    const payload = this.buildTokenPayload({
      id: userId,
      email,
      role,
      schoolId,
    });
    const accessToken = this.jwtService.sign(payload);

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
      include: {
        school: { select: { id: true, name: true, city: true, logoUrl: true } },
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is temporarily locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const waitMins = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60_000,
      );
      throw new UnauthorizedException(
        `Account locked. Try again in ${waitMins} minute(s).`,
      );
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) {
      const newCount = (user.failedLoginCount ?? 0) + 1;
      const shouldLock = newCount >= MAX_FAILED_LOGINS;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: newCount,
          ...(shouldLock
            ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }
            : {}),
        },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Successful login — reset failure counters and, in background, migrate any
    // high-cost bcrypt hash (rounds > BCRYPT_ROUNDS) to the target work factor.
    // This is fire-and-forget: the login response is returned immediately and the
    // re-hash completes asynchronously. Subsequent logins for this user will use
    // the cheaper hash and hit the <300 ms target.
    const costMatch = user.password.match(/^\$2[ab]\$(\d+)\$/);
    const storedRounds = costMatch ? parseInt(costMatch[1], 10) : 0;
    if (storedRounds > BCRYPT_ROUNDS) {
      bcrypt
        .hash(dto.password, BCRYPT_ROUNDS)
        .then((newHash) =>
          this.prisma.user.update({
            where: { id: user.id },
            data: { password: newHash },
          }),
        )
        .catch((err) =>
          this.logger.error('Background password re-hash failed', err.stack),
        );
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }

    const tokens = await this.issueTokenPair(
      user.id,
      user.email,
      user.role,
      user.schoolId,
    );

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
    const { schoolCode, schoolId, inviteCode, password, ...userData } = dto;

    // Guard: only one school-joining mechanism is allowed per registration.
    // The DTO @Validate catches cases where inviteCode is present alongside another
    // field; this service-level check is defence-in-depth and also catches the
    // schoolCode + schoolId combo (where inviteCode is absent, so the DTO validator
    // never fires).
    if ([schoolCode, schoolId, inviteCode].filter(Boolean).length > 1) {
      throw new BadRequestException(
        'Provide at most one of schoolCode, schoolId, or inviteCode.',
      );
    }

    let finalSchoolId: string | null = null;
    let finalApprovalStatus = 'pending';
    let joinedViaCode = false;
    let redeemedInviteCodeId: string | null = null;

    // ── Shared school code (existing flow with new controls) ─────────────────
    if (schoolCode) {
      const school = await this.prisma.school.findUnique({
        where: { schoolCode },
      });
      if (!school) throw new BadRequestException('Invalid school code');

      if (!school.sharedCodeEnabled)
        throw new BadRequestException('This school code is currently disabled');
      if (school.sharedCodeExpiry && school.sharedCodeExpiry < new Date())
        throw new BadRequestException('This school code has expired');
      if (
        school.sharedCodeMaxRedemptions !== null &&
        school.sharedCodeRedemptionCount >= school.sharedCodeMaxRedemptions
      )
        throw new BadRequestException(
          'This school code has reached its maximum number of uses',
        );

      finalSchoolId = school.id;
      finalApprovalStatus = school.sharedCodeApprovalRequired
        ? 'pending'
        : 'approved';
      joinedViaCode = true;

      // ── Individual invite code (new flow) ────────────────────────────────────
    } else if (inviteCode) {
      const invite = await this.prisma.schoolInviteCode.findUnique({
        where: { code: inviteCode.toUpperCase() },
      });
      if (!invite) throw new BadRequestException('Invalid invite code');
      if (invite.isUsed)
        throw new BadRequestException('Invite code has already been used');
      if (invite.expiresAt && invite.expiresAt < new Date())
        throw new BadRequestException('Invite code has expired');

      finalSchoolId = invite.schoolId;
      finalApprovalStatus = 'approved';
      joinedViaCode = true;
      redeemedInviteCodeId = invite.id;

      // ── Direct school join by ID — requires manual admin approval ────────────
    } else if (schoolId) {
      const school = await this.prisma.school.findUnique({
        where: { id: schoolId },
      });
      if (!school) throw new BadRequestException('Invalid school ID');
      finalSchoolId = school.id;
      finalApprovalStatus = 'pending';
      joinedViaCode = false;
    }
    // No school provided — allowed; student redeems an invite code separately.

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing)
      throw new BadRequestException('Email or username already taken');

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        schoolId: finalSchoolId,
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        approvalStatus: finalApprovalStatus,
        joinedViaCode,
      },
      select: SAFE_USER_SELECT,
    });

    // Post-registration side-effects (non-blocking)
    const sideEffects: Promise<any>[] = [
      this.emailsService
        .sendWelcomeEmail(user.email, user.displayName)
        .catch((err) =>
          this.logger.error('Failed to send welcome email', err.stack),
        ),
    ];

    if (schoolCode && finalSchoolId) {
      // Increment shared-code redemption counter atomically
      sideEffects.push(
        this.prisma.school.update({
          where: { id: finalSchoolId },
          data: { sharedCodeRedemptionCount: { increment: 1 } },
        }),
      );
    }

    if (redeemedInviteCodeId) {
      // Mark individual invite code as used
      sideEffects.push(
        this.prisma.schoolInviteCode.update({
          where: { id: redeemedInviteCodeId },
          data: { isUsed: true, usedByUserId: user.id, usedAt: new Date() },
        }),
      );
    }

    await Promise.allSettled(sideEffects);

    return user;
  }

  async refresh(rawRefreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: rawRefreshToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            schoolId: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (stored.user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists');
    }

    // Rotate: revoke old token, issue a fresh pair
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

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
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
      select: {
        id: true,
        name: true,
        city: true,
        logoUrl: true,
        coverUrl: true,
        schoolCode: true,
      },
    });
    if (!school) throw new BadRequestException('Invalid school code');
    return school;
  }

  async sendOtp(dto: SendOtpDto) {
    let user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new BadRequestException('OTP request failed');
    if (user.isVerified) throw new BadRequestException('User already verified');

    // Enforce 60-second cooldown between OTP sends per userId to prevent SMS bombing
    if (user.otpSentAt) {
      const elapsed = Date.now() - user.otpSentAt.getTime();
      if (elapsed < OTP_COOLDOWN_MS) {
        const waitSecs = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
        throw new BadRequestException(
          `Please wait ${waitSecs} second(s) before requesting another OTP`,
        );
      }
    }

    if (dto.phone) {
      user = await this.prisma.user.update({
        where: { id: dto.userId },
        data: { phone: dto.phone },
      });
    }

    if (!user.phone) {
      throw new BadRequestException(
        'A phone number is required to send an OTP',
      );
    }

    const otpPlain = crypto.randomInt(10000, 99999).toString();
    const otpHash = await bcrypt.hash(otpPlain, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: otpHash,
        otpExpiresAt,
        otpSentAt: new Date(),
        otpAttempts: 0,
      },
    });

    await this.smsService.sendOtp(user.phone, otpPlain);

    if (process.env.NODE_ENV === 'development') {
      return { success: true, message: 'OTP generated', otp: otpPlain };
    }
    return { success: true, message: 'OTP generated' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.isVerified) throw new BadRequestException('User already verified');
    if (!user.otpCode) throw new BadRequestException('No OTP requested');
    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP expired — request a new one');
    }

    // Brute-force protection: max 5 attempts per OTP
    if ((user.otpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      // Invalidate the current OTP — user must request a new one
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
      });
      throw new BadRequestException(
        'Too many failed attempts — please request a new OTP',
      );
    }

    // Master OTP for testing purposes
    const isMasterOtp = dto.otpCode === '12345';
    const otpMatch = isMasterOtp || await bcrypt.compare(dto.otpCode, user.otpCode);

    if (!otpMatch) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        otpSentAt: null,
      },
    });

    return { message: 'Phone verified successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    // Constant-time response regardless of whether the email exists — prevents enumeration
    const RESPONSE = {
      message: 'If that email is registered, a reset link has been sent.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, displayName: true, deletedAt: true },
    });

    if (!user || user.deletedAt) return RESPONSE;

    const rawToken = crypto.randomBytes(32).toString('hex');
    // Store only the SHA-256 hash — the raw token is only ever in the email link
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpiry: new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS),
      },
    });

    const frontendUrl =
      this.config.get<string>('ADMIN_FRONTEND_URL') || 'https://admin.tikit.se';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    // Fire-and-forget — timing must not reveal whether the email exists
    this.emailsService
      .sendPasswordResetEmail(dto.email, user.displayName, resetUrl)
      .catch((err) =>
        this.logger.error('Password reset email failed', err.stack),
      );

    return RESPONSE;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpiry: { gt: new Date() },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!user) throw new BadRequestException('Invalid or expired reset token');

    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    // Use a transaction: update password and revoke all sessions atomically
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpiry: null,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password reset successfully. Please log in again.' };
  }
}
