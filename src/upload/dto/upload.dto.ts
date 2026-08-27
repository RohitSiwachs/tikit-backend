import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export class GetPresignedUrlDto {
  @ApiProperty({
    description: 'The name of the file being uploaded (e.g. image.jpg)',
  })
  @IsString()
  filename: string;

  @ApiProperty({
    description: 'MIME type of the file to upload',
    enum: ALLOWED_MIME_TYPES,
    example: 'image/jpeg',
  })
  @IsIn(ALLOWED_MIME_TYPES, {
    message: `content_type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`,
  })
  content_type: AllowedMimeType;

  @ApiProperty({
    required: false,
    description: 'Optional folder path in the storage bucket (e.g. avatars)',
  })
  @IsOptional()
  @IsString()
  folder?: string;
}
