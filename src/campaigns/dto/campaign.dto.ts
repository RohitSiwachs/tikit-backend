import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsNumber,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CampaignSegmentFiltersDto {
  @ApiPropertyOptional() @IsOptional() @IsString() schoolId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() className?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gender?: string;

  @ApiPropertyOptional({ description: 'Filter to users with marketingConsent=true' })
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;

  @ApiPropertyOptional({ description: 'Filter to users with partnerConsent=true' })
  @IsOptional() @IsBoolean() partnerOptIn?: boolean;

  @ApiPropertyOptional({ description: 'Filter to users with notifPush=true' })
  @IsOptional() @IsBoolean() pushEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Filter to users with notifEmail=true' })
  @IsOptional() @IsBoolean() emailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Filter to users with notifSms=true' })
  @IsOptional() @IsBoolean() smsEnabled?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsNumber() minAge?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxAge?: number;

  @ApiPropertyOptional({ description: 'Users who have any ticket for this eventId' })
  @IsOptional() @IsString() goingEventId?: string;

  @ApiPropertyOptional({ description: 'Users who have a CardCode for this cardId' })
  @IsOptional() @IsString() cardId?: string;

  @ApiPropertyOptional({ description: 'Users who have an ISSUED ticket for this eventId' })
  @IsOptional() @IsString() fetchedTicketEventId?: string;
}

export class CreateCampaignDto {
  @ApiProperty({ enum: ['push', 'email', 'sms'] })
  @IsString()
  @IsNotEmpty()
  channel: string;

  @ApiProperty({ type: CampaignSegmentFiltersDto })
  @IsObject()
  @ValidateNested()
  @Type(() => CampaignSegmentFiltersDto)
  segmentFilters: CampaignSegmentFiltersDto;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({ enum: ['immediate', 'scheduled'] })
  @IsString()
  @IsNotEmpty()
  sendMode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}
