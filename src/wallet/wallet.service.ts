import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { MembershipCard } from '../entities/membership-card.entity.js';
import { Ticket } from '../entities/ticket.entity.js';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(MembershipCard) private readonly cardRepo: Repository<MembershipCard>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async getCards(userId: string) {
    const cards = await this.cardRepo.find({
      where: { user_id: userId },
      relations: ['school'],
      order: { created_at: 'DESC' },
    });
    // Auto-update expired cards
    const now = new Date();
    for (const card of cards) {
      if (new Date(card.valid_until) < now && card.status === 'active') {
        card.status = 'expired' as any;
        await this.cardRepo.save(card);
      }
    }
    return { cards };
  }

  async getCardDetail(cardId: string, userId: string) {
    const card = await this.cardRepo.findOne({
      where: { id: cardId, user_id: userId },
      relations: ['user', 'school'],
    });
    if (!card) throw new NotFoundException('Card not found');
    return card;
  }

  async getTickets(userId: string) {
    return this.ticketRepo.find({
      where: { user_id: userId },
      relations: ['event', 'event.venue', 'ticket_type'],
      order: { created_at: 'DESC' },
    });
  }

  async activateCard(userId: string, activationCode: string) {
    // In a real system, activation codes would map to a pre-created card template
    // For now, we validate the code format
    if (!activationCode || activationCode.length < 4) {
      throw new BadRequestException('Invalid activation code');
    }
    // This would be expanded with a card_activation_codes table
    return { message: 'Card activated successfully' };
  }
}
