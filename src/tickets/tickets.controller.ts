import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Post,
  Body,
  Request,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';
import { ClaimTicketDto } from './dto/claim-ticket.dto';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post('claim')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG, Role.STUDENT)
  @ApiOperation({ summary: 'Claim a free ticket for an event' })
  claimFreeTicket(@Request() req: any, @Body() dto: ClaimTicketDto) {
    return this.ticketsService.claimFreeTicket(
      req.user.id,
      dto.eventId,
      dto.ticketTypeId,
      req.user.schoolId,
    );
  }
  // from here the get api starts
  @Get()
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG)
  @ApiOperation({ summary: 'List tickets (admin)' })
  findAll(
    @Query('eventId') eventId?: string,
    @Query('userId') userId?: string,
  ) {
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
  @ApiOperation({ summary: 'Manually check-in a ticket by ID' })
  checkIn(@Param('id') id: string) {
    return this.ticketsService.checkIn(id);
  }

  @Get(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG, Role.STUDENT)
  @ApiOperation({ summary: 'Get ticket details' })
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }
}
