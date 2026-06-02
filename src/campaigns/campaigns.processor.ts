import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CampaignsService } from './campaigns.service';
import { CAMPAIGNS_QUEUE } from './campaigns.constants';

export interface SendCampaignJobData {
  campaignId: string;
}

@Processor(CAMPAIGNS_QUEUE, { concurrency: 5 })
export class CampaignsProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignsProcessor.name);

  constructor(private readonly campaignsService: CampaignsService) {
    super();
  }

  async process(job: Job<SendCampaignJobData>): Promise<void> {
    const { campaignId } = job.data;
    this.logger.log(`Job ${job.id}: processing campaign ${campaignId}`);
    await this.campaignsService.runSend(campaignId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Campaign job ${job.id} exhausted retries: ${err.message}`,
      err.stack,
    );
  }
}
