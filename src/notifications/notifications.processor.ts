import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import { NOTIFICATIONS_QUEUE } from './notifications.constants';

export interface SendNotificationJobData {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Processor(NOTIFICATIONS_QUEUE, { concurrency: 10 })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private readonly expo = new Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
  });

  async process(job: Job<SendNotificationJobData>): Promise<{ sent: number; failed: number }> {
    const { tokens, title, body, data } = job.data;

    this.logger.log(`Job ${job.id}: processing ${tokens.length} tokens`);

    const validTokens = tokens.filter((token) => {
      const valid = Expo.isExpoPushToken(token);
      if (!valid) this.logger.warn(`Job ${job.id}: invalid token skipped — ${token}`);
      return valid;
    });

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: data ?? {},
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    let successCount = 0;
    let failureCount = 0;

    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket) => {
          if (ticket.status === 'ok') successCount++;
          else {
            failureCount++;
            this.logger.warn(`Job ${job.id}: ticket failed — ${ticket.message}`);
          }
        });
      } catch (err) {
        this.logger.error(`Job ${job.id}: Expo chunk failed`, err);
        failureCount += chunk.length;
      }
    }

    this.logger.log(`Job ${job.id}: completed — ${successCount} sent, ${failureCount} failed`);
    return { sent: successCount, failed: failureCount };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Notification job ${job.id} exhausted retries: ${err.message}`,
      err.stack,
    );
  }
}
