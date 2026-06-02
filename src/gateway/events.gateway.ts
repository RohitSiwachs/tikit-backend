import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../prisma-enums';

// Roles that can join any event room regardless of ticket ownership
const SCANNER_ROLES = new Set([
  Role.TIKIT_ADMIN,
  Role.KARORDFORANDE,
  Role.EVENTANSVARIG,
  Role.SCANNER,
]);

@WebSocketGateway({
  cors: {
    origin: (
      origin: string,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowed = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      if (
        process.env.NODE_ENV !== 'production' ||
        !allowed.length ||
        allowed.includes(origin)
      ) {
        cb(null, true);
      } else {
        cb(new Error('WebSocket CORS blocked'));
      }
    },
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers?.authorization as string)?.replace(
        'Bearer ',
        '',
      );

    if (!token) {
      this.logger.warn(`WS rejected — no token: ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify(token);
      (client as any).user = {
        id: payload.sub,
        role: payload.role,
        schoolId: payload.schoolId,
      };

      // Auto-join the user's school room so they receive school-scoped feed broadcasts
      if (payload.schoolId) {
        client.join(`school:${payload.schoolId}`);
      }

      this.logger.log(
        `WS connected: ${client.id} (user=${payload.sub}, role=${payload.role})`,
      );
    } catch {
      this.logger.warn(`WS rejected — invalid token: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_event')
  async handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { event_id: string },
  ) {
    const user = (client as any).user as
      | { id: string; role: string }
      | undefined;

    if (!user?.id) {
      client.disconnect(true);
      return { error: 'Not authenticated' };
    }

    if (!data?.event_id || typeof data.event_id !== 'string') {
      return { error: 'event_id is required' };
    }

    // Admin/scanner roles can join any event room without a ticket check
    if (!SCANNER_ROLES.has(user.role as Role)) {
      const ticket = await this.prisma.ticket.findFirst({
        where: {
          userId: user.id,
          eventId: data.event_id,
          status: { not: 'VOID' },
        },
        select: { id: true },
      });

      if (!ticket) {
        return { error: 'Access denied — no valid ticket for this event' };
      }
    }

    const room = `event:${data.event_id}`;
    client.join(room);
    return { event: 'joined', room };
  }

  @SubscribeMessage('leave_event')
  handleLeaveEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { event_id: string },
  ) {
    const room = `event:${data.event_id}`;
    client.leave(room);
    return { event: 'left', room };
  }

  // Broadcast to all clients watching a specific event (scanners + attendees who joined)
  emitCheckinUpdate(
    eventId: string,
    payload: {
      userId: string;
      userName: string;
      ticketType: string;
      checkedInAt: Date | null;
      totalCheckins: number;
    },
  ) {
    this.server.to(`event:${eventId}`).emit('checkin:update', payload);
  }

  emitTicketSold(
    eventId: string,
    payload: { ticketTypeId: string; remaining: number },
  ) {
    this.server.to(`event:${eventId}`).emit('ticket:sold', payload);
  }

  // Broadcast new posts to school room only — not to all connected clients
  emitNewPost(schoolId: string, payload: { postId: string; authorId: string }) {
    this.server.to(`school:${schoolId}`).emit('feed:new_post', payload);
  }

  emitNewComment(
    schoolId: string,
    postId: string,
    payload: { commentId: string; authorId: string },
  ) {
    this.server
      .to(`school:${schoolId}`)
      .emit('feed:new_comment', { postId, ...payload });
  }
}
