import { Controller, Get, Patch, Param, Query, Post, Body, Request } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post('claim')
  @ApiOperation({ summary: 'Claim a free ticket' })
  claimFreeTicket(
    @Request() req: any,
    @Body('eventId') eventId: string,
    @Body('ticketTypeId') ticketTypeId: string,
  ) {
    return this.ticketsService.claimFreeTicket(req.user.sub, eventId, ticketTypeId);
  }

  @Get()
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'List tickets' })
  findAll(@Query('eventId') eventId?: string, @Query('userId') userId?: string) {
    return this.ticketsService.findAll(eventId, userId);
  }

  @Patch(':id/void')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Void a ticket' })
  voidTicket(@Param('id') id: string) {
    return this.ticketsService.voidTicket(id);
  }

  @Patch(':id/check-in')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Check-in a ticket' })
  checkIn(@Param('id') id: string) {
    return this.ticketsService.checkIn(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket details' })
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }
}
