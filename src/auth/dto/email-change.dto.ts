import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCurrentEmailOtpDto {
  @ApiProperty({ description: '6-digit OTP sent to current email' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otpCode: string;
}

export class SetNewEmailDto {
  @ApiProperty({ description: 'New email address to change to' })
  @IsEmail()
  newEmail: string;

  @ApiProperty({ description: 'Change session token received after verifying current email OTP' })
  @IsString()
  changeToken: string;
}

export class ConfirmNewEmailOtpDto {
  @ApiProperty({ description: '6-digit OTP sent to the new email address' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otpCode: string;

  @ApiProperty({ description: 'Change session token received after verifying current email OTP' })
  @IsString()
  changeToken: string;
}
