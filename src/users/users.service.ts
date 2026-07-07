import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { generateFormattedCode } from '../common/utils/code-generator';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../prisma-enums';

const SAFE_USER_SELECT = {
  id: true,
  displayName: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
  avatarUrl: true,
  role: true,
  accountStatus: true,
  approvalStatus: true,
  joinedViaCode: true,
  className: true,
  schoolId: true,
  createdAt: true,
} as const;

// Picks only the cardId from each CardCode row so callers can build assignedCardIds
const CARD_CODES_ID_SELECT = {
  cardCodes: { select: { cardId: true } },
} as const;
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    role?: Role;
    schoolId?: string;
    approvalStatus?: string;
    className?: string;
    year?: number;
    page?: number;
    limit?: number;
  }) {
    const {
      role,
      schoolId,
      approvalStatus,
      className,
      year,
      page = 1,
      limit = 10,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role) where.role = role;
    if (schoolId) where.schoolId = schoolId;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (className) where.className = className;

    // To filter by year, we need to find classes for that year first
    if (year && schoolId) {
      const classesForYear = await this.prisma.class.findMany({
        where: { schoolId, graduationYear: year },
        select: { className: true },
      });
      const classNames = classesForYear.map((c) => c.className);

      if (className && !classNames.includes(className)) {
        where.className = 'NON_EXISTENT_CLASS_TRIGGER_EMPTY';
      } else if (!className) {
        where.className = { in: classNames };
      }
    }

    const [total, rawData] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          ...SAFE_USER_SELECT,
          school: { select: { name: true } },
          ...CARD_CODES_ID_SELECT,
        },
      }),
    ]);

    const data = rawData.map(({ cardCodes, ...user }) => ({
      ...user,
      assignedCardIds: [...new Set(cardCodes.map((c) => c.cardId))],
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateRole(id: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  async updateApproval(id: string, status: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    return this.prisma.user.update({
      where: { id },
      data: { approvalStatus: status },
    });
  }

  async getPendingApprovals(schoolId: string) {
    return this.prisma.user.findMany({
      where: { schoolId, approvalStatus: 'pending', role: 'STUDENT' },
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getManualApprovals(schoolId: string) {
    return this.prisma.user.findMany({
      where: {
        schoolId,
        approvalStatus: 'approved',
        joinedViaCode: false,
        role: 'STUDENT',
      },
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminUpdate(id: string, dto: any, requestingUser: any) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException(`User ${id} not found`);

    if (
      requestingUser.role !== 'TIKIT_ADMIN' &&
      targetUser.schoolId !== requestingUser.schoolId
    ) {
      throw new ConflictException(
        'You can only update students from your own school',
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: SAFE_USER_SELECT,
    });
  }

  async findOne(id: string, requestingUser?: { role?: string }) {
    const isSuperAdmin = requestingUser?.role === 'TIKIT_ADMIN';
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...SAFE_USER_SELECT,
        ...(isSuperAdmin ? { tempPassword: true } : {}),
        school: { select: { name: true } },
        ...CARD_CODES_ID_SELECT,
      },
    });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    const { cardCodes, ...rest } = user as any;
    return {
      ...rest,
      assignedCardIds: [...new Set(cardCodes.map((c: any) => c.cardId))],
    };
  }

  async getFullDetails(id: string, requestingUser?: { role?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        school: true,
        tickets: {
          include: {
            event: true,
            ticketType: true,
          },
        },
        cardCodes: {
          include: {
            card: true,
          },
        },
        followers: { select: { id: true, displayName: true, username: true } },
        following: { select: { id: true, displayName: true, username: true } },
      },
    });

    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    // Strip sensitive fields — tempPassword re-added only for TIKIT_ADMIN
    // Cast to any: Prisma generated types may lag behind schema until next full
    // client regeneration; the field exists in DB after migration.
    const { password, otpCode, tempPassword, ...userWithoutSensitiveData } =
      user as any;
    const isSuperAdmin = requestingUser?.role === 'TIKIT_ADMIN';

    const eventsAttended = user.tickets.filter(
      (t) => t.status === 'CHECKED_IN',
    ).length;
    const cardsActivated = user.cardCodes.filter((c) => c.isUsed).length;

    return {
      ...userWithoutSensitiveData,
      ...(isSuperAdmin ? { tempPassword } : {}),
      metrics: {
        totalTickets: user.tickets.length,
        eventsAttended,
        totalCards: user.cardCodes.length,
        cardsActivated,
        followersCount: user.followers.length,
        followingCount: user.following.length,
      },
    };
  }

  async updateStatus(id: string, status: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    return this.prisma.user.update({
      where: { id },
      data: { accountStatus: status },
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    // Delete dependent records first to avoid FK constraint violations
    return this.prisma.$transaction(async (tx) => {
      await tx.ticket.deleteMany({ where: { userId: id } });
      await tx.cardCode.deleteMany({ where: { userId: id } });
      await tx.followRequest.deleteMany({
        where: { OR: [{ senderId: id }, { receiverId: id }] },
      });
      return tx.user.delete({ where: { id } });
    });
  }

  async getProfile(username: string, requestingUserId: string) {
    // Both lookups are independent — run in parallel to save one sequential round-trip.
    const [user, requestingUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          school: { select: { id: true, name: true } },
          className: true,
          biography: true,
          achievements: true,
          socialLinks: true,
          isVisibleToOtherSchools: true,
          isPrivateAccount: true,
          _count: {
            select: {
              followers: true,
              friends: true,
              tickets: true,
            },
          },
          followers: {
            where: { id: requestingUserId },
          },
          tickets: {
            where: {
              event: {
                startsAt: { gte: new Date() }, // optional: only upcoming events
              },
            },
            include: {
              event: true,
            },
            take: 10,
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: requestingUserId },
      }),
    ]);

    if (!user)
      throw new NotFoundException(`User profile for ${username} not found`);

    // Privacy Rules Evaluation
    let isDetailedViewAllowed = true;

    // 1. If it's a private account, only followers (or the user themselves) can see details.
    if (user.isPrivateAccount && user.id !== requestingUserId) {
      if (user.followers.length === 0) {
        isDetailedViewAllowed = false;
      }
    }

    // 2. Users from other schools may only see limited information
    if (
      requestingUser &&
      requestingUser.schoolId !== user.school?.id &&
      user.id !== requestingUserId
    ) {
      if (!user.isVisibleToOtherSchools) {
        isDetailedViewAllowed = false;
      }
    }

    const { tickets, _count, followers, ...rest } = user;

    if (!isDetailedViewAllowed) {
      return {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        school: user.school,
        isPrivateAccount: user.isPrivateAccount,
        counts: {
          followers: _count.followers,
          friends: _count.friends,
          events: _count.tickets,
        },
        isFollowing: followers.length > 0,
        message:
          'This account is private or restricts detailed view from other schools.',
      };
    }

    return {
      ...rest,
      counts: {
        followers: _count.followers,
        friends: _count.friends,
        events: _count.tickets,
      },
      attendingEvents: tickets.map((t) => t.event),
      isFollowing: followers.length > 0,
    };
  }

  async getIncomingFollowRequests(userId: string) {
    return this.prisma.followRequest.findMany({
      where: { receiverId: userId, status: 'pending' },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true,
            school: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async requestFollow(senderId: string, receiverId: string) {
    if (senderId === receiverId)
      throw new BadRequestException('Cannot follow yourself');

    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
    });
    if (!receiver) throw new NotFoundException('User not found');

    if (!receiver.isPrivateAccount) {
      // Auto-approve if not private
      await this.prisma.user.update({
        where: { id: receiverId },
        data: {
          followers: {
            connect: { id: senderId },
          },
        },
      });
      return { message: 'Followed successfully', status: 'approved' };
    }

    // Create follow request for private account
    const existingReq = await this.prisma.followRequest.findFirst({
      where: { senderId, receiverId, status: 'pending' },
    });

    if (existingReq)
      throw new ConflictException('Follow request already pending');

    await this.prisma.followRequest.create({
      data: { senderId, receiverId },
    });

    return { message: 'Follow request sent', status: 'pending' };
  }

  async respondToFollowRequest(
    userId: string,
    requestId: string,
    status: string,
  ) {
    const request = await this.prisma.followRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.receiverId !== userId) {
      throw new NotFoundException('Follow request not found or unauthorized');
    }

    if (status === 'approved') {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          followers: {
            connect: { id: request.senderId },
          },
        },
      });
    }

    return this.prisma.followRequest.update({
      where: { id: requestId },
      data: { status },
    });
  }

  async unfollow(followerId: string, targetId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: targetId },
      data: { followers: { disconnect: { id: followerId } } },
    });

    return { message: 'Unfollowed successfully' };
  }

  async assignCards(cardId: string, userIds: string[]) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: { schoolId: true, codeGenerationType: true },
    });

    if (!card) throw new NotFoundException('Card not found');

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, schoolId: true },
    });

    if (users.length !== userIds.length) {
      throw new BadRequestException('One or more users not found');
    }

    const invalidUsers = users.filter(
      (u) => !u.schoolId || u.schoolId !== card.schoolId,
    );
    if (invalidUsers.length > 0) {
      throw new BadRequestException(
        `Cannot assign card. ${invalidUsers.length} user(s) do not belong to the card's school.`,
      );
    }

    const now = new Date();

    if (card.codeGenerationType === 'batch') {
      // ── Pre-flight ──────────────────────────────────────────────────────────
      // Determine net demand (excluding users already assigned) and compare it
      // against the current pool size BEFORE opening a transaction.  This way:
      //  • we can report exact counts in the error message
      //  • no writes ever happen when the pool is too small (nothing to roll back)
      const [availableCount, existingAssignments] = await Promise.all([
        this.prisma.cardCode.count({
          where: { cardId, userId: null, isUsed: false },
        }),
        this.prisma.cardCode.findMany({
          where: { cardId, userId: { in: userIds } },
          select: { userId: true },
        }),
      ]);

      const alreadyAssignedSet = new Set(
        existingAssignments.map((c) => c.userId as string),
      );
      const toAssign = userIds.filter((id) => !alreadyAssignedSet.has(id));
      const netRequired = toAssign.length;

      if (netRequired === 0) {
        return {
          message: 'All selected users already have this card assigned.',
          assigned: 0,
          skipped: userIds.length,
        };
      }

      if (availableCount < netRequired) {
        throw new BadRequestException({
          message: `Card assignment failed. Requested ${netRequired} assignment(s) but only ${availableCount} unused code(s) are available.`,
          availableCodes: availableCount,
          requestedAssignments: netRequired,
        });
      }

      // ── Transaction ─────────────────────────────────────────────────────────
      // We know the pool is large enough, so enter the transaction.
      // All UPDATE statements execute on the same DB connection; if anything
      // throws, Prisma issues ROLLBACK and re-throws — 0 codes are consumed.
      // The inner `!available` guard is a race-condition backstop: a concurrent
      // request could deplete the pool between the count above and this point.
      return this.prisma.$transaction(async (tx) => {
        let assigned = 0;

        for (const userId of toAssign) {
          const available = await tx.cardCode.findFirst({
            where: { cardId, userId: null, isUsed: false },
            select: { id: true },
          });

          if (!available) {
            // Pool was depleted by a concurrent request after our pre-flight
            // count.  Throw → Prisma issues ROLLBACK → 0 codes consumed.
            throw new BadRequestException({
              message: `Card assignment failed due to a concurrent conflict. The code pool was exhausted mid-assignment. Please retry.`,
              availableCodes: 0,
              requestedAssignments: netRequired,
            });
          }

          await tx.cardCode.update({
            where: { id: available.id },
            data: { userId, assignedAt: now },
          });

          assigned++;
        }

        return {
          message: `Card assigned to ${assigned} student(s). ${alreadyAssignedSet.size} already had this card.`,
          assigned,
          skipped: alreadyAssignedSet.size,
        };
      });
    }

    // Individual mode: generate a fresh code per user and bulk-insert.
    const alreadyAssigned = await this.prisma.cardCode.findMany({
      where: { cardId, userId: { in: userIds } },
      select: { userId: true },
    });
    const alreadyAssignedIds = new Set(alreadyAssigned.map((c) => c.userId));
    const toAssign = userIds.filter((id) => !alreadyAssignedIds.has(id));

    if (toAssign.length === 0) {
      return {
        message: 'All selected users already have this card assigned.',
        assigned: 0,
        skipped: userIds.length,
      };
    }

    const codesToCreate = toAssign.map((userId) => ({
      cardId,
      userId,
      code: generateFormattedCode(),
      isUsed: false,
      assignedAt: now,
    }));

    await this.prisma.cardCode.createMany({
      data: codesToCreate,
      skipDuplicates: true,
    });

    return {
      message: `Card assigned to ${toAssign.length} student(s). ${alreadyAssignedIds.size} already had this card.`,
      assigned: toAssign.length,
      skipped: alreadyAssignedIds.size,
    };
  }

  async getEngagementData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        tickets: {
          select: {
            id: true,
            status: true,
            checkedInAt: true,
            event: { select: { title: true, startsAt: true } },
          },
        },
        cardCodes: {
          select: {
            id: true,
            isUsed: true,
            usedAt: true,
            card: { select: { title: true } },
          },
        },
      },
    });

    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

    const eventsAttended = user.tickets.filter(
      (t) => t.status === 'CHECKED_IN',
    ).length;
    const cardsActivated = user.cardCodes.filter((c) => c.isUsed).length;

    return {
      userId: user.id,
      displayName: user.displayName,
      metrics: {
        totalTickets: user.tickets.length,
        eventsAttended,
        attendanceRate:
          user.tickets.length > 0
            ? (eventsAttended / user.tickets.length) * 100
            : 0,
        totalCards: user.cardCodes.length,
        cardsActivated,
      },
      tickets: user.tickets,
      cards: user.cardCodes,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

    const updateData: any = { ...dto };

    if (dto.birthdate) {
      updateData.birthdate = new Date(dto.birthdate);
    }

    // Auto-compile displayName if firstName or lastName changes, and no explicit displayName was passed
    if (!dto.displayName && (dto.firstName || dto.lastName)) {
      const currentFirstName =
        dto.firstName !== undefined ? dto.firstName : user.firstName;
      const currentLastName =
        dto.lastName !== undefined ? dto.lastName : user.lastName;
      const nameParts = [currentFirstName, currentLastName].filter(Boolean);
      if (nameParts.length > 0) {
        updateData.displayName = nameParts.join(' ');
      }
    }

    if (dto.username && dto.username !== user.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existing) {
        throw new BadRequestException('Username is already taken');
      }
    }

    if (dto.className && user.schoolId) {
      const classExists = await this.prisma.class.findFirst({
        where: {
          schoolId: user.schoolId,
          className: dto.className,
        },
      });
      if (!classExists) {
        await this.prisma.class.create({
          data: {
            schoolId: user.schoolId,
            className: dto.className,
            graduationYear: new Date().getFullYear() + 3,
          },
        });
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: SAFE_USER_SELECT,
    });
  }
}
