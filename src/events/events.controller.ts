import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/create-event.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG)
  @ApiOperation({ summary: 'Create a new event with ticket types' })
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(createEventDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all events' })
  findAll(
    @Query('schoolId') schoolId?: string,
    @Query('isPublished') isPublished?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventsService.findAll({
      schoolId,
      isPublished:
        isPublished === 'true'
          ? true
          : isPublished === 'false'
            ? false
            : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event details' })
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG)
  @ApiOperation({ summary: 'Update event (publish/cancel)' })
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventsService.update(id, updateEventDto);
  }

  @Get(':id/attendees')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG, Role.SCANNER)
  @ApiOperation({ summary: 'Get list of attendees for an event' })
  getAttendees(@Param('id') id: string) {
    return this.eventsService.getAttendees(id);
  }

  @Delete(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Delete an event' })
  async remove(@Param('id') id: string) {
    await this.eventsService.remove(id);
    return {
      message: 'Event deleted successfully',
      id,
    };
  }

  @Post(':id/ticket-types')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG)
  @ApiOperation({ summary: 'Add a ticket type to an event' })
  createTicketType(
    @Param('id') id: string,
    @Body() createTicketTypeDto: CreateTicketTypeDto,
  ) {
    return this.eventsService.createTicketType(id, createTicketTypeDto);
  }

  @Patch(':id/ticket-types/:ticketTypeId')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG)
  @ApiOperation({ summary: 'Update a ticket type' })
  updateTicketType(
    @Param('ticketTypeId') ticketTypeId: string,
    @Body() updateTicketTypeDto: UpdateTicketTypeDto,
  ) {
    return this.eventsService.updateTicketType(ticketTypeId, updateTicketTypeDto);
  }

  @Delete(':id/ticket-types/:ticketTypeId')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG)
  @ApiOperation({ summary: 'Delete a ticket type' })
  removeTicketType(@Param('ticketTypeId') ticketTypeId: string) {
    return this.eventsService.removeTicketType(ticketTypeId);
  }
}
