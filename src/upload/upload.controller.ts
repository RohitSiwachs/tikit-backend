import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UploadService } from './upload.service';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('api/v1/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Generate pre-signed S3 URL for direct upload' })
  presign(
    @Body() body: { filename: string; content_type: string; folder?: string },
  ) {
    return this.uploadService.generatePresignedUrl(body);
  }
}
