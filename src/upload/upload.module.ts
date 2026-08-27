import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import s3Config from '../config/s3.config';

@Module({
  imports: [ConfigModule.forFeature(s3Config)],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
