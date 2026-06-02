import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignScheduler } from './campaign.scheduler';
import { CampaignsProcessor } from './campaigns.processor';
import { CAMPAIGNS_QUEUE } from './campaigns.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailsModule } from '../emails/emails.module';

@Module({
  imports: [
    PrismaModule,
    EmailsModule,
    BullModule.registerQueue({ name: CAMPAIGNS_QUEUE }),
    BullBoardModule.forFeature({
      name: CAMPAIGNS_QUEUE,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignScheduler, CampaignsProcessor],
  exports: [CampaignsService],
})
export class CampaignsModule {}
