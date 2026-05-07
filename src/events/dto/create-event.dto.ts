import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsUUID,
  ValidateNested,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventType } from '../../common/enums.js';

class CreateTicketTypeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsInt()
  @Min(1)
  total_inventory: number;

  @IsOptional()
  @IsString()
  external_link?: string;

  @IsOptional()
  @IsBoolean()
  requires_membership?: boolean;

  @IsOptional()
  @IsUUID()
  linked_card_id?: string;

  @IsOptional()
  @IsDateString()
  sale_starts_at?: string;

  @IsOptional()
  @IsDateString()
  sale_ends_at?: string;
}

class CreateVenueDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;
}

export class CreateEventDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  cover_image_url?: string;

  @IsOptional()
  @IsEnum(EventType)
  event_type?: EventType;

  @IsOptional()
  @IsString()
  category?: string;

  @ValidateNested()
  @Type(() => CreateVenueDto)
  venue: CreateVenueDto;

  @IsDateString()
  starts_at: string;

  @IsDateString()
  ends_at: string;

  @IsOptional()
  @IsUUID()
  linked_card_id?: string;

  @IsOptional()
  @IsBoolean()
  is_draft?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTicketTypeDto)
  ticket_types?: CreateTicketTypeDto[];
}
