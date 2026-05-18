import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampaignScheduler {
  private readonly logger = new Logger(CampaignScheduler.name);

  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly prisma: PrismaService,
  ) {}

  // Runs every minute to check for due scheduled campaigns
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledCampaigns() {
    const now = new Date();

    const dueCampaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: {
          lte: now, // scheduledAt is in the past or now
        },
      },
    });

    if (dueCampaigns.length === 0) return;

    this.logger.log(`Found ${dueCampaigns.length} scheduled campaign(s) to send`);

    for (const campaign of dueCampaigns) {
      try {
        this.logger.log(`Triggering campaign: ${campaign.id} — "${campaign.title}"`);
        await this.campaignsService.triggerSend(campaign.id);
        this.logger.log(`Campaign ${campaign.id} sent successfully`);
      } catch (err) {
        this.logger.error(`Failed to send campaign ${campaign.id}: ${err.message}`);
      }
    }
  }
}
