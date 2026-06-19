import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateIndividualCodesDto {
  @ApiPropertyOptional({ description: 'Number of codes to generate (1–500, default 1)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  count?: number;

  @ApiPropertyOptional({ description: 'Pre-fill student name on the code' })
  @IsOptional()
  @IsString()
  studentName?: string;

  @ApiPropertyOptional({ description: 'Pre-fill student email on the code' })
  @IsOptional()
  @IsString()
  studentEmail?: string;

  @ApiPropertyOptional({ description: 'ISO date string — code expires at this datetime' })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class RedeemIndividualCodeDto {
  @ApiPropertyOptional({ description: 'The individual invite code to redeem' })
  @IsString()
  code: string;
}
