import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { EventType } from '../../prisma-enums';

export class CreateTicketTypeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    required: false,
    default: 0,
    description:
      'Ignored for INTERNAL events — always forced to 0. Reserved for future external use.',
  })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty()
  @IsNumber()
  quantityTotal: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  fewLeftThreshold?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  priceDisplay?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deepLink?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  salesStartsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  salesEndsAt?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  trackQuantity?: boolean;

  @ApiProperty({
    required: false,
    enum: ['available', 'fewLeft', 'soldOut'],
    default: 'available',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    required: false,
    enum: ['mostPopular', 'fewLeft', 'sellingFast'],
    nullable: true,
  })
  @IsOptional()
  @IsString()
  label?: string | null;
}

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiProperty({ enum: ['INTERNAL', 'EXTERNAL'] })
  @IsEnum(EventType)
  eventType: EventType;

  @ApiProperty()
  @IsString()
  schoolId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  venueName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  venueAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  placeId?: string;

  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  endsAt: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  ageLimit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  externalTicketStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  showImGoingButton?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  attendanceVisibility?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  externalPriceDisplay?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  linkedCardIds?: string[];

  @ApiProperty({
    required: false,
    description:
      'If true, only students who hold one of the linkedCardIds can see and access this event',
  })
  @IsOptional()
  @IsBoolean()
  restrictToCardHolders?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  connectedSchools?: string[];

  @ApiProperty({
    required: false,
    description:
      'ISO date for scheduled publication. Event will auto-publish at this time.',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiProperty({ type: [CreateTicketTypeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTicketTypeDto)
  ticketTypes: CreateTicketTypeDto[];
}

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isCancelled?: boolean;
}

export class UpdateTicketTypeDto extends PartialType(CreateTicketTypeDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isSoldOut?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  quantityRemaining?: number;
}
