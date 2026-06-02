import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePostDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;

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
}

export class UpdatePostDto extends PartialType(CreatePostDto) {}
