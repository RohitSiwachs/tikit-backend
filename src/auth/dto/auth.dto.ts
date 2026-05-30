import { IsString, IsEmail, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty()
  @IsString()
  schoolCode: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;
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
  @MinLength(6)
  @MaxLength(6)
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
