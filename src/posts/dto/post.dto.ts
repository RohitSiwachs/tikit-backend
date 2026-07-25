import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsDateString,
  IsBoolean,
} from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  postType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty({
    required: false,
    type: [String],
    description:
      'Additional school IDs this post should be visible to (TIKIT_ADMIN only). Students from all listed schools will see this post in their feed.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  connectedSchoolIds?: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  authorId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pollOptions?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  pollExpiresAt?: string;

  @ApiProperty({
    required: false,
    description:
      'ISO date for scheduled publication. Post will be hidden until this time.',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  // ── Countdown post fields ─────────────────────────────────────────────────

  @ApiProperty({
    required: false,
    description:
      'Event name displayed on the countdown card (e.g. "Vinterbalen")',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    required: false,
    description: 'ISO timestamp the client uses to calculate remaining time',
  })
  @IsOptional()
  @IsDateString()
  eventDateTime?: string;

  @ApiProperty({
    required: false,
    description: 'Venue / location string (e.g. "Valand")',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    required: false,
    description: 'Badge label shown above the title (e.g. "SNART DAGS")',
  })
  @IsOptional()
  @IsString()
  badgeText?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdatePostDto extends PartialType(CreatePostDto) {}
