import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationTriggersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEvent(eventId: string) {
    return this.prisma.notificationTriggerOverride.findMany({
      where: { eventId },
      orderBy: { triggerKey: 'asc' },
    });
  }

  async upsert(
    schoolId: string,
    eventId: string,
    triggerKey: string,
    title: string,
    body: string,
  ) {
    return this.prisma.notificationTriggerOverride.upsert({
      where: {
        schoolId_eventId_triggerKey: { schoolId, eventId, triggerKey },
      },
      create: { schoolId, eventId, triggerKey, title, body },
      update: { title, body },
    });
  }

  async deleteOne(schoolId: string, eventId: string, triggerKey: string) {
    const existing = await this.prisma.notificationTriggerOverride.findUnique({
      where: {
        schoolId_eventId_triggerKey: { schoolId, eventId, triggerKey },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `No override found for event ${eventId} / triggerKey ${triggerKey}`,
      );
    }

    await this.prisma.notificationTriggerOverride.delete({
      where: { id: existing.id },
    });

    return { message: 'Override deleted' };
  }

  // Called by NotificationsService before dispatching any event-scoped notification.
  // Returns the override copy if one exists, otherwise returns the supplied defaults.
  async resolveContent(
    schoolId: string | undefined,
    eventId: string | undefined,
    triggerKey: string | undefined,
    defaultTitle: string,
    defaultBody: string,
  ): Promise<{ title: string; body: string }> {
    if (!schoolId || !eventId || !triggerKey) {
      return { title: defaultTitle, body: defaultBody };
    }

    const override = await this.prisma.notificationTriggerOverride.findUnique({
      where: {
        schoolId_eventId_triggerKey: { schoolId, eventId, triggerKey },
      },
    });

    return {
      title: override?.title ?? defaultTitle,
      body: override?.body ?? defaultBody,
    };
  }
}
