import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity.js';
import { School } from '../entities/school.entity.js';
import { RegisterDto, LoginDto } from './dto/index.js';
import jwtConfig from '../config/jwt.config.js';
import type { JwtPayload } from './jwt.strategy.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConf: ConfigType<typeof jwtConfig>,
  ) {}

  // ─── Register ──────────────────────────────────────────────
  async register(dto: RegisterDto) {
    // 1. Verify school code
    const school = await this.schoolRepo.findOne({
      where: { school_code: dto.school_code },
    });
    if (!school) {
      throw new NotFoundException('Invalid school code');
    }

    // 2. Check duplicate email
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // 3. Hash password
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    const password_hash = await bcrypt.hash(dto.password, rounds);

    // 4. Create user
    const user = this.userRepo.create({
      email: dto.email,
      display_name: `${dto.first_name} ${dto.last_name}`,
      phone: dto.phone,
      password_hash,
      birth_date: dto.birth_date ? new Date(dto.birth_date) : undefined,
      school_year: dto.school_year,
      class_name: dto.class_name,
      role: dto.role,
      school_id: school.id,
    });

    const saved = await this.userRepo.save(user);

    // 5. Issue tokens
    const tokens = await this.issueTokens(saved);

    return {
      user: {
        id: saved.id,
        email: saved.email,
        display_name: saved.display_name,
        role: saved.role,
        school_id: saved.school_id,
      },
      ...tokens,
    };
  }

  // ─── Login ─────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        school_id: user.school_id,
      },
      ...tokens,
    };
  }

  // ─── Refresh ───────────────────────────────────────────────
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.refresh_token_hash) {
      throw new UnauthorizedException('Access denied');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.issueTokens(user);
    return tokens;
  }

  // ─── Logout ────────────────────────────────────────────────
  async logout(userId: string) {
    await this.userRepo.update(userId, {
      refresh_token_hash: undefined as any,
    });
  }

  // ─── Helpers ───────────────────────────────────────────────
  private async issueTokens(user: User) {
    const payload: Record<string, unknown> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      school_id: user.school_id,
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        algorithm: 'RS256',
        privateKey: this.jwtConf.privateKey,
        expiresIn: this.jwtConf.accessExpiration as any,
      }),
      this.jwtService.signAsync(payload, {
        algorithm: 'RS256',
        privateKey: this.jwtConf.privateKey,
        expiresIn: this.jwtConf.refreshExpiration as any,
      }),
    ]);

    // Store hashed refresh token for rotation
    const hash = await bcrypt.hash(refresh_token, 10);
    await this.userRepo.update(user.id, { refresh_token_hash: hash });

    return { access_token, refresh_token };
  }
}
