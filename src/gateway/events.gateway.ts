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

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger = new Logger('EventsGateway');

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');

    if (!token) {
      this.logger.warn(`WS rejected — no token: ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify(token);
      (client as any).user = { id: payload.sub, role: payload.role };
      this.logger.log(`WS connected: ${client.id} (user=${payload.sub})`);
    } catch {
      this.logger.warn(`WS rejected — invalid token: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_event')
  handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { event_id: string },
  ) {
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

  emitCheckinUpdate(eventId: string, payload: any) {
    this.server.to(`event:${eventId}`).emit('checkin:update', payload);
  }

  emitTicketSold(eventId: string, payload: any) {
    this.server.to(`event:${eventId}`).emit('ticket:sold', payload);
  }

  emitNewPost(payload: any) {
    this.server.emit('feed:new_post', payload);
  }

  emitNewComment(postId: string, payload: any) {
    this.server.emit('feed:new_comment', { comment: payload, post_id: postId });
  }
}
