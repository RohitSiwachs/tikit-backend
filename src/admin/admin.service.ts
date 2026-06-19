import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, TicketStatus } from '../prisma-enums';
import { UpdateCommunicationAllocationDto } from '../communication/dto/communication.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [
      totalSchools,
      totalStudents,
      upcomingEvents,
      activeCards,
      totalTickets,
      checkedInTickets,
    ] = await Promise.all([
      this.prisma.school.count(),
      this.prisma.user.count({ where: { role: Role.STUDENT } }),
      this.prisma.event.count({ where: { startsAt: { gt: new Date() } } }),
      this.prisma.card.count({ where: { status: 'active' } }),
      this.prisma.ticket.count(),
      this.prisma.ticket.count({ where: { status: TicketStatus.CHECKED_IN } }),
    ]);

    const checkinRate =
      totalTickets > 0 ? (checkedInTickets / totalTickets) * 100 : 0;

    return {
      totalSchools,
      totalStudents,
      upcomingEvents,
      activeCards,
      checkinRate: Math.round(checkinRate * 100) / 100,
    };
  }

  // ─── Communication Usage ──────────────────────────────────────────────────

  async getAllCommunicationUsage() {
    const schools = await this.prisma.school.findMany({
      select: {
        id: true,
        name: true,
        communicationAllocation: true,
      },
      orderBy: { name: 'asc' },
    });

    return schools.map((s) => {
      const a = s.communicationAllocation;
      return {
        schoolId: s.id,
        schoolName: s.name,
        pushAllocated: a?.pushAllocated ?? 0,
        pushUsed: a?.pushUsed ?? 0,
        pushRemaining: Math.max(0, (a?.pushAllocated ?? 0) - (a?.pushUsed ?? 0)),
        emailAllocated: a?.emailAllocated ?? 0,
        emailUsed: a?.emailUsed ?? 0,
        emailRemaining: Math.max(0, (a?.emailAllocated ?? 0) - (a?.emailUsed ?? 0)),
        smsAllocated: a?.smsAllocated ?? 0,
        smsUsed: a?.smsUsed ?? 0,
        smsRemaining: Math.max(0, (a?.smsAllocated ?? 0) - (a?.smsUsed ?? 0)),
      };
    });
  }

  async getSchoolCommunicationUsage(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, communicationAllocation: true },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    const a = school.communicationAllocation;
    return {
      push: {
        allocated: a?.pushAllocated ?? 0,
        used: a?.pushUsed ?? 0,
        remaining: Math.max(0, (a?.pushAllocated ?? 0) - (a?.pushUsed ?? 0)),
      },
      email: {
        allocated: a?.emailAllocated ?? 0,
        used: a?.emailUsed ?? 0,
        remaining: Math.max(0, (a?.emailAllocated ?? 0) - (a?.emailUsed ?? 0)),
      },
      sms: {
        allocated: a?.smsAllocated ?? 0,
        used: a?.smsUsed ?? 0,
        remaining: Math.max(0, (a?.smsAllocated ?? 0) - (a?.smsUsed ?? 0)),
      },
    };
  }

  async updateCommunicationAllocation(
    schoolId: string,
    dto: UpdateCommunicationAllocationDto,
  ) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    const data: any = {};
    if (dto.pushAllocated !== undefined) data.pushAllocated = dto.pushAllocated;
    if (dto.emailAllocated !== undefined) data.emailAllocated = dto.emailAllocated;
    if (dto.smsAllocated !== undefined) data.smsAllocated = dto.smsAllocated;
    if (dto.pushPrice !== undefined) data.pushPrice = dto.pushPrice;
    if (dto.emailPrice !== undefined) data.emailPrice = dto.emailPrice;
    if (dto.smsPrice !== undefined) data.smsPrice = dto.smsPrice;

    return this.prisma.communicationAllocation.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });
  }
}
