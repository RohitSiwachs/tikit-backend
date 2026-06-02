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

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledCampaigns() {
    const now = new Date();

    // Only pick up campaigns in 'scheduled' status that are due.
    // 'processing' means already running (possibly on another instance — Phase 4 adds distributed lock).
    // 'failed' means it needs manual review before retrying.
    const dueCampaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
      select: { id: true, title: true },
    });

    if (dueCampaigns.length === 0) return;

    this.logger.log(`Scheduler: ${dueCampaigns.length} campaign(s) due`);

    for (const campaign of dueCampaigns) {
      try {
        await this.campaignsService.triggerSend(campaign.id);
        this.logger.log(`Scheduler: triggered campaign "${campaign.title}" (${campaign.id})`);
      } catch (err) {
        // triggerSend throws if the campaign is already processing — that's fine
        this.logger.error(`Scheduler: failed to trigger campaign ${campaign.id}: ${err.message}`);
      }
    }
  }
}
