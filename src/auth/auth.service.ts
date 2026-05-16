import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, RegisterDto } from './dto/auth.dto';
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
    return this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        schoolId: school.id,
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        approvalStatus: 'pending',
      },
    });
  }
}
