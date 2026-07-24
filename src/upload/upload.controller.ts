import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UploadService } from './upload.service';
import { GetPresignedUrlDto } from './dto/upload.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presigned-url')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @Throttle({ default: { ttl: 60_000, limit: 20 } }) // 20 presigned URLs per minute per user
  @ApiOperation({
    summary: 'Get a presigned URL to upload a file directly to S3',
  })
  @ApiBody({ type: GetPresignedUrlDto })
  async getPresignedUrl(@Body() body: GetPresignedUrlDto) {
    return this.uploadService.generatePresignedUrl(body);
  }
}
