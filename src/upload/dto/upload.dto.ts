import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class GetPresignedUrlDto {
  @ApiProperty({ description: 'The name of the file being uploaded (e.g. image.jpg)' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'The MIME type of the file (e.g. image/jpeg)' })
  @IsString()
  content_type: string;

  @ApiProperty({ required: false, description: 'Optional folder path in the storage bucket (e.g. avatars)' })
  @IsOptional()
  @IsString()
  folder?: string;
}
