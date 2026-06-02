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
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  price: number;

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

  @ApiProperty({ required: false, description: 'If true, host-school students can claim this ticket for free' })
  @IsOptional()
  @IsBoolean()
  freeForHostSchool?: boolean;
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

  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  endsAt: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  externalBuyUrl?: string;

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

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  connectedSchools?: string[];

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

export class UpdateTicketTypeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isSoldOut?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  quantityRemaining?: number;

  @ApiProperty({ required: false, description: 'Toggle free eligibility for host-school students' })
  @IsOptional()
  @IsBoolean()
  freeForHostSchool?: boolean;
}
