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

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger = new Logger('EventsGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
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
    this.logger.log(`Client ${client.id} joined room ${room}`);
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

  /** Called by TicketsService after a successful check-in */
  emitCheckinUpdate(eventId: string, payload: any) {
    this.server.to(`event:${eventId}`).emit('checkin:update', payload);
  }

  /** Called by TicketsService after a ticket is sold */
  emitTicketSold(eventId: string, payload: any) {
    this.server.to(`event:${eventId}`).emit('ticket:sold', payload);
  }

  /** Called by FeedService when a new post is created */
  emitNewPost(payload: any) {
    this.server.emit('feed:new_post', payload);
  }

  /** Called by FeedService when a new comment is added */
  emitNewComment(postId: string, payload: any) {
    this.server.emit('feed:new_comment', { comment: payload, post_id: postId });
  }
}
