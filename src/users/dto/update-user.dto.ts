import {
  IsEnum,
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../prisma-enums';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ['TIKIT_ADMIN', 'KARORDFORANDE', 'STUDENT'] })
  @IsEnum(Role)
  role: Role;
}

export class UpdateUserApprovalDto {
  @ApiProperty({ enum: ['approved', 'pending', 'rejected'] })
  @IsString()
  status: string;
}

export class AdminUpdateUserDto {
  // ── Basic identity ─────────────────────────────────────────────────────────
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  biography?: string;

  // ── School placement ───────────────────────────────────────────────────────
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  className?: string;

  @ApiProperty({
    required: false,
    description: 'ID of the school to assign the user to',
  })
  @IsOptional()
  @IsString()
  schoolId?: string;

  // ── Personal details ───────────────────────────────────────────────────────
  @ApiProperty({
    required: false,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @ApiProperty({ required: false, minimum: 13, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(100)
  age?: number;

  // ── Preferences ────────────────────────────────────────────────────────────
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  goingOutFrequency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  preferredGroupSize?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  eventBudget?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  achievements?: string[];

  // ── Privacy ────────────────────────────────────────────────────────────────
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isVisibleToOtherSchools?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPrivateAccount?: boolean;

  // ── Notification preferences ───────────────────────────────────────────────
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifPush?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifEmail?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifSms?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifFriendRequests?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifNewPosts?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifEventInvites?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifTicketReceipts?: boolean;

  // ── Consent ────────────────────────────────────────────────────────────────
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  partnerConsent?: boolean;
}
