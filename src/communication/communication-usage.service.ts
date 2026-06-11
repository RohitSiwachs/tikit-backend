import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Channel = 'push' | 'email' | 'sms';

// TODO(future): add per-channel transactional tracking fields:
//   pushTransactionalUsed, emailTransactionalUsed, smsTransactionalUsed
// These will sit alongside pushUsed/emailUsed/smsUsed (campaign totals) so
// callers can distinguish broadcast vs. transactional consumption without a
// schema redesign — just add the columns and increment them from the relevant
// service (auth OTP, ticket receipts, etc.).

@Injectable()
export class CommunicationUsageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Quota rules:
   *   - No CommunicationAllocation record → school is unlimited, pass through.
   *   - Record exists, allocated = 0   → channel is fully blocked (0 quota).
   *   - Record exists, used >= allocated → exhausted, block.
   *   - Record exists, used < allocated  → quota available, pass through.
   */
  async checkQuota(schoolId: string, channel: Channel): Promise<void> {
    const alloc = await this.prisma.communicationAllocation.findUnique({
      where: { schoolId },
    });

    // No record at all → no limits configured, allow unrestricted sending
    if (!alloc) return;

    const allocated = alloc[`${channel}Allocated`] as number;
    const used = alloc[`${channel}Used`] as number;

    // allocated = 0 means the channel is BLOCKED (no quota granted).
    // used >= allocated catches the exhausted case for allocated > 0.
    if (used >= allocated) {
      throw new ConflictException(
        `School has insufficient ${channel} quota.`,
      );
    }
  }

  async incrementPushUsage(schoolId: string, count: number): Promise<void> {
    if (count <= 0) return;
    await this.prisma.communicationAllocation.upsert({
      where: { schoolId },
      create: { schoolId, pushUsed: count },
      update: { pushUsed: { increment: count } },
    });
  }

  async incrementEmailUsage(schoolId: string, count: number): Promise<void> {
    if (count <= 0) return;
    await this.prisma.communicationAllocation.upsert({
      where: { schoolId },
      create: { schoolId, emailUsed: count },
      update: { emailUsed: { increment: count } },
    });
  }

  async incrementSmsUsage(schoolId: string, count: number): Promise<void> {
    if (count <= 0) return;
    await this.prisma.communicationAllocation.upsert({
      where: { schoolId },
      create: { schoolId, smsUsed: count },
      update: { smsUsed: { increment: count } },
    });
  }
}
