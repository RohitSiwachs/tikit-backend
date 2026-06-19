import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SegmentFiltersDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() minAge?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxAge?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() schoolId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() eventId?: string;
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

  @ApiPropertyOptional({ description: 'Trigger key used to look up a NotificationTriggerOverride, e.g. event_reminder_24h' })
  @IsOptional()
  @IsString()
  triggerKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
