import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs every minute to auto-publish events whose scheduledAt has arrived.
   * Sets isPublished=true, status='published', and clears scheduledAt.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduledEvents() {
    const now = new Date();

    const events = await this.prisma.event.findMany({
      where: {
        scheduledAt: { lte: now },
        status: 'scheduled',
        isPublished: false,
        isCancelled: false,
        deletedAt: null,
      },
      select: { id: true, title: true },
    });

    if (events.length === 0) return;

    this.logger.log(`Auto-publishing ${events.length} scheduled event(s)...`);

    await this.prisma.event.updateMany({
      where: {
        id: { in: events.map((e) => e.id) },
      },
      data: {
        isPublished: true,
        status: 'published',
        scheduledAt: null,
      },
    });

    for (const event of events) {
      this.logger.log(`Published event: "${event.title}" (${event.id})`);
    }
  }

  /**
   * Runs every minute to auto-publish posts whose scheduledAt has arrived.
   * Clears scheduledAt so the post appears in feeds (the query filter handles visibility).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduledPosts() {
    const now = new Date();

    const posts = await this.prisma.post.findMany({
      where: {
        scheduledAt: { lte: now },
        deletedAt: null,
      },
      select: { id: true, body: true },
    });

    if (posts.length === 0) return;

    this.logger.log(`Auto-publishing ${posts.length} scheduled post(s)...`);

    await this.prisma.post.updateMany({
      where: {
        id: { in: posts.map((p) => p.id) },
      },
      data: {
        scheduledAt: null,
      },
    });

    for (const post of posts) {
      this.logger.log(
        `Published post: "${post.body.substring(0, 40)}..." (${post.id})`,
      );
    }
  }
}
