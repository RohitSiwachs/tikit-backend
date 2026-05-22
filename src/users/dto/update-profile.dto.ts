import { IsString, IsOptional, IsInt, IsBoolean, Min, Max, IsArray, IsISO8601 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
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
  gender?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  birthdate?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(12)
  @Max(120)
  age?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  className?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  biography?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPrivateAccount?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isVisibleToOtherSchools?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  socialLinks?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  partnerConsent?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  language?: string;

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
}
