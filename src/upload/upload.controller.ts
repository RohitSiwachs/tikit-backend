import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { GetPresignedUrlDto } from './dto/upload.dto';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Get a presigned URL to upload a file directly to S3' })
  @ApiBody({ type: GetPresignedUrlDto })
  async getPresignedUrl(
    @Body() body: GetPresignedUrlDto,
  ) {
    return this.uploadService.generatePresignedUrl(body);
  }
}
