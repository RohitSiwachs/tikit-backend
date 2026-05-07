import { Controller, Post, Get, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TicketsService } from './tickets.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('api/v1/events/:eventId')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post('tickets/purchase')
  @ApiOperation({ summary: 'Purchase a ticket (Checkout flow)' })
  purchase(
    @Param('eventId') eventId: string,
    @Body() body: { ticket_type_id: string; quantity: number; voucher_code?: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.ticketsService.purchase(eventId, body, user.id);
  }

  @Post('checkin')
  @Roles(UserRole.SCANNER, UserRole.KAR_ADMIN, UserRole.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Check in via QR scan (Scanner screen)' })
  checkin(
    @Param('eventId') eventId: string,
    @Body('qr_token') qrToken: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.ticketsService.checkin(eventId, qrToken, user.id);
  }

  @Get('guests')
  @Roles(UserRole.SCANNER, UserRole.KAR_ADMIN, UserRole.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Search guests (Scanner search bar)' })
  searchGuests(
    @Param('eventId') eventId: string,
    @Query('q') query: string,
  ) {
    return this.ticketsService.searchGuests(eventId, query);
  }
}
