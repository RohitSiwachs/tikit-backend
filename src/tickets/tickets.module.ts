import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { TicketsService } from './tickets.service.js';
import { TicketsController } from './tickets.controller.js';
import { Ticket } from '../entities/ticket.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { Event } from '../entities/event.entity.js';
import { Voucher } from '../entities/voucher.entity.js';
import { CheckIn } from '../entities/check-in.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketType, Event, Voucher, CheckIn]),
    JwtModule.register({}),
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
