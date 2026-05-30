import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignScheduler } from './campaign.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailsModule } from '../emails/emails.module';

@Module({
  imports: [PrismaModule, EmailsModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignScheduler],
  exports: [CampaignsService],
})
export class CampaignsModule {}
