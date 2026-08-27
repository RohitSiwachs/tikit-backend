import { Module } from '@nestjs/common';
import { CommunicationUsageService } from './communication-usage.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CommunicationUsageService],
  exports: [CommunicationUsageService],
})
export class CommunicationModule {}
