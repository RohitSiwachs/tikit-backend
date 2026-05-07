import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service.js';
import { EventsController } from './events.controller.js';
import { Event } from '../entities/event.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { Venue } from '../entities/venue.entity.js';
import { Ticket } from '../entities/ticket.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Event, TicketType, Venue, Ticket])],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
