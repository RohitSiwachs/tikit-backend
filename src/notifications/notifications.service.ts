import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendNotificationDto } from './dto/notification.dto';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private readonly expo = new Expo();
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async sendToSegment(dto: SendNotificationDto) {
    const { segmentFilters } = dto;

    const where: any = {
      deletedAt: null, // Never send to soft-deleted (GDPR erased) users
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

    const validTokens = users
      .map((u) => u.expoPushToken!)
      .filter((token) => Expo.isExpoPushToken(token));

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      sound: 'default',
      title: dto.title,
      body: dto.body,
      data: dto.data ?? {},
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
            this.logger.warn(`Push notification failed: ${ticket.message}`);
          }
        });
      } catch (err) {
        this.logger.error('Expo push chunk failed', err);
        failureCount += chunk.length;
      }
    }

    return {
      success: true,
      targetUserCount: users.length,
      sent: successCount,
      failed: failureCount,
      skippedNoToken: users.length - validTokens.length,
    };
  }
}
