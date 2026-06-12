import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EmailsService } from '../emails/emails.service';
import { CommunicationUsageService } from '../communication/communication-usage.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { CAMPAIGNS_QUEUE, SEND_CAMPAIGN_JOB } from './campaigns.constants';

// Campaign status state machine:
// draft → processing → sent
// draft → scheduled → processing → sent
// processing → failed (on unhandled error)
type CampaignStatus = 'draft' | 'scheduled' | 'processing' | 'sent' | 'failed';
type Channel = 'push' | 'email' | 'sms';

const BATCH_SIZE = 100;

// Lazily loaded ESM module — expo-server-sdk v6+ is ESM-only
let _expoModule: typeof import('expo-server-sdk') | null = null;
async function getExpoModule() {
  if (!_expoModule) {
    _expoModule = await import('expo-server-sdk');
  }
  return _expoModule;
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  private expo: InstanceType<(typeof import('expo-server-sdk'))['Expo']> | null = null;

  private async getExpo() {
    if (!this.expo) {
      const { Expo } = await getExpoModule();
      this.expo = new Expo({
        accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
      });
    }
    return this.expo;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailsService: EmailsService,
    private readonly communicationUsageService: CommunicationUsageService,
    @InjectQueue(CAMPAIGNS_QUEUE) private readonly campaignsQueue: Queue,
  ) {}

  create(dto: CreateCampaignDto) {
    const data: any = { ...dto };
    if (data.scheduledAt) data.scheduledAt = new Date(data.scheduledAt);
    return this.prisma.campaign.create({ data });
  }

  findAll() {
    return this.prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  update(id: string, dto: UpdateCampaignDto) {
    const data: any = { ...dto };
    if (data.scheduledAt) data.scheduledAt = new Date(data.scheduledAt);
    return this.prisma.campaign.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.campaign.delete({ where: { id } });
  }

  async triggerSend(
    id: string,
  ): Promise<{ message: string; campaignId: string }> {
    const campaign = await this.findOne(id);

    if (campaign.status === 'sent') {
      throw new BadRequestException('Campaign has already been sent');
    }
    if (campaign.status === 'processing') {
      throw new BadRequestException('Campaign send is already in progress');
    }

    // Quota check — throws 409 if school has no remaining quota for this channel
    const schoolId = (campaign.segmentFilters as any)?.schoolId as string | undefined;
    if (schoolId && ['push', 'email', 'sms'].includes(campaign.channel)) {
      await this.communicationUsageService.checkQuota(
        schoolId,
        campaign.channel as Channel,
      );
    }

    // Atomic lock: only transitions from draft or scheduled → processing.
    // If two callers race here, only one gets count=1.
    const locked = await this.prisma.campaign.updateMany({
      where: { id, status: { in: ['draft', 'scheduled'] } },
      data: { status: 'processing' as CampaignStatus },
    });

    if (locked.count === 0) {
      throw new BadRequestException('Campaign could not be locked for sending');
    }

    await this.campaignsQueue.add(
      SEND_CAMPAIGN_JOB,
      { campaignId: id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    );

    this.logger.log(`Campaign ${id} queued for background send`);
    return { message: 'Campaign send started', campaignId: id };
  }

  // Called by triggerSend (via setImmediate) and by the scheduler.
  // Processes users in cursor-based batches to avoid loading all users into heap at once.
  async runSend(id: string): Promise<void> {
    const campaign = await this.findOne(id);
    const filters: any = (campaign.segmentFilters as any) ?? {};

    const baseWhere: any = {
      deletedAt: null, // Never contact GDPR-deleted users
    };
    if (filters.schoolId) baseWhere.schoolId = filters.schoolId;
    if (filters.className) baseWhere.className = filters.className;
    if (filters.role) baseWhere.role = filters.role;

    // Respect per-channel notification preferences — never contact opted-out users
    if (campaign.channel === 'push') baseWhere.notifPush = true;
    if (campaign.channel === 'sms') baseWhere.notifSms = true;
    if (campaign.channel === 'email') baseWhere.notifEmail = true;

    let cursor: string | undefined;
    let totalSent = 0;

    try {
      while (true) {
        const batch = await this.prisma.user.findMany({
          where: baseWhere,
          take: BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
          select: { id: true, phone: true, email: true, expoPushToken: true },
        });

        if (batch.length === 0) break;

        cursor = batch[batch.length - 1].id;
        totalSent += await this.sendBatch(campaign, batch);

        // Yield to the event loop between batches so HTTP handlers aren't starved
        await new Promise<void>((resolve) => setImmediate(resolve));
      }

      await this.prisma.campaign.update({
        where: { id },
        data: { status: 'sent' as CampaignStatus, sentCount: totalSent },
      });

      // Increment usage only on full success — do NOT track if campaign failed
      const schoolId = filters.schoolId as string | undefined;
      if (schoolId && totalSent > 0 && ['push', 'email', 'sms'].includes(campaign.channel)) {
        const channel = campaign.channel as Channel;
        if (channel === 'push') await this.communicationUsageService.incrementPushUsage(schoolId, totalSent);
        else if (channel === 'email') await this.communicationUsageService.incrementEmailUsage(schoolId, totalSent);
        else if (channel === 'sms') await this.communicationUsageService.incrementSmsUsage(schoolId, totalSent);
      }

      this.logger.log(`Campaign ${id} sent to ${totalSent} recipients`);
    } catch (err) {
      this.logger.error(
        `Campaign ${id} failed after ${totalSent} sends`,
        err.stack,
      );
      // Best-effort status update — don't throw, the scheduler will see 'failed' and not retry
      await this.prisma.campaign
        .update({
          where: { id },
          data: { status: 'failed' as CampaignStatus },
        })
        .catch(() => {});
    }
  }

  private async sendBatch(campaign: any, batch: any[]): Promise<number> {
    let sent = 0;

    if (campaign.channel === 'push') {
      const { Expo } = await getExpoModule();
      const expo = await this.getExpo();
      const messages = batch
        .filter((u) => u.expoPushToken && Expo.isExpoPushToken(u.expoPushToken))
        .map((u) => ({
          to: u.expoPushToken,
          sound: 'default' as const,
          title: campaign.title,
          body: campaign.body,
          data: { campaignId: campaign.id },
        }));

      if (messages.length > 0) {
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
          try {
            const results = await expo.sendPushNotificationsAsync(chunk);
            sent += results.filter((r) => r.status === 'ok').length;
          } catch (err) {
            this.logger.error('Push chunk failed', err.message);
          }
        }
      }
    } else if (campaign.channel === 'sms') {
      this.logger.warn(
        `Campaign ${campaign.id}: SMS channel is not supported — skipping batch`,
      );
    } else if (campaign.channel === 'email') {
      for (const user of batch) {
        if (!user.email) continue;
        try {
          const result = await this.emailsService.sendCampaignEmail(
            user.email,
            campaign.title,
            campaign.body,
          );
          if (result.success) sent++;
        } catch (err) {
          this.logger.warn(`Email to user ${user.id} failed: ${err.message}`);
        }
      }
    }

    return sent;
  }

  async getReport(id: string) {
    const campaign = await this.findOne(id);
    const openRate =
      campaign.sentCount > 0
        ? (campaign.openCount / campaign.sentCount) * 100
        : 0;

    return {
      campaignId: campaign.id,
      title: campaign.title,
      channel: campaign.channel,
      status: campaign.status,
      sentCount: campaign.sentCount,
      openCount: campaign.openCount,
      openRate: openRate.toFixed(2) + '%',
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt,
    };
  }
}
