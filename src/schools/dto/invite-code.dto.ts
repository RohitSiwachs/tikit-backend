import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateIndividualCodesDto {
  @ApiPropertyOptional({
    description: 'List of individual invite codes provided from the frontend',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  codes?: string[];

  @ApiPropertyOptional({ description: 'Pre-fill student name on the code' })
  @IsOptional()
  @IsString()
  studentName?: string;

  @ApiPropertyOptional({ description: 'Pre-fill student email on the code' })
  @IsOptional()
  @IsString()
  studentEmail?: string;

  @ApiPropertyOptional({
    description: 'ISO date string — code expires at this datetime',
  })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class RedeemIndividualCodeDto {
  @ApiPropertyOptional({ description: 'The individual invite code to redeem' })
  @IsString()
  code: string;
}
