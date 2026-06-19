import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationTriggersService } from '../notification-triggers/notification-triggers.service';
import { SendNotificationDto } from './dto/notification.dto';
import {
  NOTIFICATIONS_QUEUE,
  SEND_NOTIFICATION_JOB,
} from './notifications.constants';
import { SendNotificationJobData } from './notifications.processor';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly notificationTriggersService: NotificationTriggersService,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationsQueue: Queue,
  ) {}

  async sendToSegment(dto: SendNotificationDto) {
    const { segmentFilters } = dto;

    const where: any = {
      deletedAt: null,
      expoPushToken: { not: null },
      notifPush: true,
    };

    if (segmentFilters.schoolId) where.schoolId = segmentFilters.schoolId;

    if (segmentFilters.minAge || segmentFilters.maxAge) {
      where.age = {};
      if (segmentFilters.minAge) where.age.gte = segmentFilters.minAge;
      if (segmentFilters.maxAge) where.age.lte = segmentFilters.maxAge;
    }

    if (segmentFilters.eventId) {
      where.tickets = { some: { eventId: segmentFilters.eventId } };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, expoPushToken: true },
    });

    const { Expo } = await import('expo-server-sdk');

    const validTokens = users
      .map((u) => u.expoPushToken!)
      .filter((token) => Expo.isExpoPushToken(token));

    if (validTokens.length === 0) {
      this.logger.warn(
        'sendToSegment: no valid tokens found, skipping enqueue',
      );
      return {
        success: true,
        targetUserCount: users.length,
        queued: 0,
        skippedNoToken: users.length,
      };
    }

    // Check for a notification copy override before dispatching.
    // If schoolId + eventId (from segmentFilters) + triggerKey are all present,
    // the persisted override title/body replaces the caller-supplied defaults.
    const { title, body } = await this.notificationTriggersService.resolveContent(
      segmentFilters.schoolId,
      segmentFilters.eventId,
      dto.triggerKey,
      dto.title,
      dto.body,
    );

    const jobData: SendNotificationJobData = {
      tokens: validTokens,
      title,
      body,
      data: dto.data ?? {},
    };

    await this.notificationsQueue.add(SEND_NOTIFICATION_JOB, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });

    this.logger.log(
      `sendToSegment: queued notification for ${validTokens.length} tokens`,
    );

    return {
      success: true,
      targetUserCount: users.length,
      queued: validTokens.length,
      skippedNoToken: users.length - validTokens.length,
    };
  }
}
