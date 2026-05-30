import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs nightly at 2 AM.
   * Deletes refresh tokens that expired or were revoked more than 24 hours ago.
   * Without this, the RefreshToken table grows without bound (~300k rows/month at 10k DAU).
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanExpiredTokens() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoff } },
          { revokedAt: { not: null, lt: cutoff } },
        ],
      },
    });

    this.logger.log(`Cleaned ${result.count} expired/revoked refresh tokens`);
  }

  /**
   * Also clean up stale password reset tokens nightly.
   * Expired reset tokens have no value and add noise to the table.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanExpiredPasswordResets() {
    await this.prisma.user.updateMany({
      where: {
        passwordResetExpiry: { lt: new Date() },
        passwordResetToken: { not: null },
      },
      data: { passwordResetToken: null, passwordResetExpiry: null },
    });
  }
}
