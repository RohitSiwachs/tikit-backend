import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum } from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  channel: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  segmentFilters: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sendMode: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}
