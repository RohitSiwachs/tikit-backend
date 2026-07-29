import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'atMostOneSchoolField', async: false })
class AtMostOneSchoolFieldConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, { object }: ValidationArguments): boolean {
    const { schoolCode, schoolId, inviteCode } = object as any;
    return [schoolCode, schoolId, inviteCode].filter(Boolean).length <= 1;
  }
  defaultMessage(): string {
    return 'Provide at most one of schoolCode, schoolId, or inviteCode.';
  }
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;
}

export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty()
  @IsString()
  displayName: string;

  @ApiProperty()
  @IsString()
  username: string;

  @ApiPropertyOptional({ description: 'Shared school code (existing flow)' })
  @IsOptional()
  @IsString()
  schoolCode?: string;

  @ApiPropertyOptional({
    description: 'Join by school ID — requires admin approval',
  })
  @IsOptional()
  @IsString()
  schoolId?: string;

  @ApiPropertyOptional({
    description: 'Individual invite code — auto-approves and links to school',
  })
  @IsOptional()
  @IsString()
  @Validate(AtMostOneSchoolFieldConstraint, {
    message: 'Provide at most one of schoolCode, schoolId, or inviteCode.',
  })
  inviteCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'The class name of the student' })
  @IsOptional()
  @IsString()
  className?: string;
}

export class SendOtpDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class VerifySchoolDto {
  @ApiProperty()
  @IsString()
  schoolCode: string;
}

export class VerifyOtpDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(5)
  otpCode: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
