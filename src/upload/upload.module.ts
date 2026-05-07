import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from './upload.service.js';
import { UploadController } from './upload.controller.js';
import s3Config from '../config/s3.config.js';

@Module({
  imports: [ConfigModule.forFeature(s3Config)],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
