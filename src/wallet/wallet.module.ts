import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service.js';
import { WalletController } from './wallet.controller.js';
import { MembershipCard } from '../entities/membership-card.entity.js';
import { Ticket } from '../entities/ticket.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([MembershipCard, Ticket])],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
