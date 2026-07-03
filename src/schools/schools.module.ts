import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { SchoolsService } from './schools.service';
import { SchoolsController } from './schools.controller';
import { EmailsModule } from '../emails/emails.module';

@Module({
  imports: [
    EmailsModule,
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    }),
  ],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
