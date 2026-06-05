import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSchoolDto } from './create-school.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSchoolDto extends PartialType(
  OmitType(CreateSchoolDto, ['schoolCode'] as const),
) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deepLink?: string;
}
