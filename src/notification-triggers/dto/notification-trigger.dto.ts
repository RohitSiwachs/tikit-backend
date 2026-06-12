import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpsertNotificationTriggerDto {
  @ApiProperty({ description: 'Logical key identifying the trigger, e.g. event_reminder_24h' })
  @IsString()
  @IsNotEmpty()
  triggerKey: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ description: 'Required when caller is TIKIT_ADMIN to specify target school' })
  @IsOptional()
  @IsString()
  schoolId?: string;
}
