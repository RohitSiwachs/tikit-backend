import { IsString, IsOptional, IsDateString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCardDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  schoolId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  benefits?: string[];

  @ApiProperty()
  @IsDateString()
  validFrom: string;

  @ApiProperty()
  @IsDateString()
  validUntil: string;

  @ApiProperty({ required: false, default: 'individual' })
  @IsOptional()
  @IsString()
  codeGenerationType?: string;
}

export class GenerateCodesDto {
  @ApiProperty()
  @IsNumber()
  count: number;
}

import { PartialType } from '@nestjs/swagger';
export class UpdateCardDto extends PartialType(CreateCardDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
