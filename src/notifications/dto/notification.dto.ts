import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SegmentFiltersDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  minAge?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  maxAge?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  schoolId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  eventId?: string;
}

export class SendNotificationDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  body: string;

  @ApiProperty({ type: SegmentFiltersDto })
  @IsObject()
  segmentFilters: SegmentFiltersDto;
}
