import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdateCommunicationAllocationDto {
  @ApiPropertyOptional({ description: 'Number of push notifications allocated', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  pushAllocated?: number;

  @ApiPropertyOptional({ description: 'Number of emails allocated', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  emailAllocated?: number;

  @ApiPropertyOptional({ description: 'Number of SMS messages allocated', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  smsAllocated?: number;

  @ApiPropertyOptional({ description: 'Reset or set used push notifications', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  pushUsed?: number;

  @ApiPropertyOptional({ description: 'Reset or set used emails', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  emailUsed?: number;

  @ApiPropertyOptional({ description: 'Reset or set used SMS', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  smsUsed?: number;

  @ApiPropertyOptional({ description: 'Price per push notification', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  pushPrice?: number;

  @ApiPropertyOptional({ description: 'Price per email', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  emailPrice?: number;

  @ApiPropertyOptional({ description: 'Price per SMS', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  smsPrice?: number;
}
