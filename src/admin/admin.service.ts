import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, TicketStatus } from '../prisma-enums';

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
}
