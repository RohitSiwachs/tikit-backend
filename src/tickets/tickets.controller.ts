import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG)
  @ApiOperation({ summary: 'List tickets' })
  findAll(@Query('eventId') eventId?: string, @Query('userId') userId?: string) {
    return this.ticketsService.findAll(eventId, userId);
  }

  @Patch(':id/void')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG)
  @ApiOperation({ summary: 'Void a ticket' })
  voidTicket(@Param('id') id: string) {
    return this.ticketsService.voidTicket(id);
  }

  @Patch(':id/check-in')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG, Role.SCANNER)
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
