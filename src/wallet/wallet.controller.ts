import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Get users wallet containing tickets and activated cards' })
  getWallet(@Request() req: any) {
    return this.walletService.getWallet(req.user.id);
  }

  @Post('activate-card')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Activate a card using a unique code' })
  activateCard(@Body('code') code: string, @Request() req: any) {
    return this.walletService.activateCard(req.user.id, code);
  }
}
