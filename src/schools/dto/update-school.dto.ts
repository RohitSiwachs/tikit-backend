import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSchoolDto } from './create-school.dto';
import { IsOptional, IsString, IsInt, Min, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSchoolDto extends PartialType(
  OmitType(CreateSchoolDto, ['schoolCode'] as const),
) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deepLink?: string;

  // ── Communication limits (TIKIT_ADMIN only — ignored for KARORDFORANDE) ──

  @ApiProperty({ required: false, description: 'Push notification quota. TIKIT_ADMIN only.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  pushAllocated?: number;

  @ApiProperty({ required: false, description: 'Email quota. TIKIT_ADMIN only.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  emailAllocated?: number;

  @ApiProperty({ required: false, description: 'SMS quota. TIKIT_ADMIN only.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  smsAllocated?: number;

  @ApiProperty({ required: false, description: 'Price per push message. TIKIT_ADMIN only.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  pushPrice?: number;

  @ApiProperty({ required: false, description: 'Price per email. TIKIT_ADMIN only.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  emailPrice?: number;

  @ApiProperty({ required: false, description: 'Price per SMS. TIKIT_ADMIN only.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  smsPrice?: number;

  // ── Shared school code controls (KARORDFORANDE or TIKIT_ADMIN) ──

  @ApiProperty({ required: false, description: 'Enable or disable the shared school code' })
  @IsOptional()
  @IsBoolean()
  sharedCodeEnabled?: boolean;

  @ApiProperty({ required: false, description: 'ISO date string — shared code expires at this datetime' })
  @IsOptional()
  @IsString()
  sharedCodeExpiry?: string;

  @ApiProperty({ required: false, description: 'Max redemptions allowed via shared code. null = unlimited.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sharedCodeMaxRedemptions?: number;

  @ApiProperty({ required: false, description: 'Require admin approval when joining via shared code' })
  @IsOptional()
  @IsBoolean()
  sharedCodeApprovalRequired?: boolean;
}
