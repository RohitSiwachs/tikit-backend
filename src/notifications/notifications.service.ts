import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async sendToSegment(dto: SendNotificationDto) {
    const { segmentFilters } = dto;

    const where: any = {};

    if (segmentFilters.schoolId) {
      where.schoolId = segmentFilters.schoolId;
    }

    if (segmentFilters.minAge || segmentFilters.maxAge) {
      where.age = {};
      if (segmentFilters.minAge) where.age.gte = segmentFilters.minAge;
      if (segmentFilters.maxAge) where.age.lte = segmentFilters.maxAge;
    }

    if (segmentFilters.eventId) {
      where.tickets = {
        some: {
          eventId: segmentFilters.eventId,
        },
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, email: true },
    });

    // In a real app, you would call a push notification service or email service here.
    console.log(
      `Sending notification "${dto.title}" to ${users.length} users.`,
    );

    return {
      success: true,
      targetUserCount: users.length,
      message: 'Notifications queued for delivery',
    };
  }
}
