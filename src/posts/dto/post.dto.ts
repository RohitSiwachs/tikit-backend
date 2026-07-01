import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsDateString } from 'class-validator';

export class CreatePostDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  postType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  authorId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pollOptions?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  pollExpiresAt?: string;

  @ApiProperty({ required: false, description: 'ISO date for scheduled publication. Post will be hidden until this time.' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdatePostDto extends PartialType(CreatePostDto) {}
