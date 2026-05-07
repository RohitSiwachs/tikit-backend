import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WalletService } from './wallet.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller('api/v1/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('cards')
  @ApiOperation({ summary: 'Get membership cards (KORT tab in Plånbok)' })
  getCards(@CurrentUser() user: { id: string }) {
    return this.walletService.getCards(user.id);
  }

  @Get('cards/:id')
  @ApiOperation({ summary: 'Get card detail with QR (Card press QR screen)' })
  getCardDetail(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.walletService.getCardDetail(id, user.id);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Get user tickets (BILJETTER tab in Plånbok)' })
  getTickets(@CurrentUser() user: { id: string }) {
    return this.walletService.getTickets(user.id);
  }

  @Post('cards/activate')
  @ApiOperation({ summary: 'Activate a card with code (Aktivera kort button)' })
  activateCard(
    @Body('activation_code') code: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.walletService.activateCard(user.id, code);
  }
}
