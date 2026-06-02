import {
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSchoolDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  slug: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiProperty()
  @IsString()
  schoolCode: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  contactEmail: string;

  @ApiProperty({ description: 'Password for the initial school admin' })
  @IsNotEmpty()
  @IsString()
  schoolAdminPassword: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
