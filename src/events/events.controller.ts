import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  Request,
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
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
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
  @ApiOperation({ summary: 'Get event details with social counts and friends attending' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.eventsService.findOne(id, req?.user?.id);
  }

  @Patch(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Update event (publish/cancel)' })
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventsService.update(id, updateEventDto);
  }

  @Get(':id/attendees')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Get list of attendees for an event' })
  getAttendees(@Param('id') id: string) {
    return this.eventsService.getAttendees(id);
  }

  @Delete(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Delete an event' })
  async remove(@Param('id') id: string) {
    await this.eventsService.remove(id);
    return { message: 'Event deleted successfully', id };
  }

  @Post(':id/duplicate')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Duplicate an event' })
  duplicateEvent(@Param('id') id: string) {
    return this.eventsService.duplicateEvent(id);
  }

  @Patch(':id/pin')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Pin an event' })
  pinEvent(@Param('id') id: string) {
    return this.eventsService.pinEvent(id);
  }

  @Patch(':id/unpin')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Unpin an event' })
  unpinEvent(@Param('id') id: string) {
    return this.eventsService.unpinEvent(id);
  }

  @Patch(':id/unpublish')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Unpublish an event' })
  unpublishEvent(@Param('id') id: string) {
    return this.eventsService.unpublishEvent(id);
  }

  // --- TICKET TYPES ---

  @Post(':id/ticket-types')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Add a ticket type to an event' })
  createTicketType(
    @Param('id') id: string,
    @Body() createTicketTypeDto: CreateTicketTypeDto,
  ) {
    return this.eventsService.createTicketType(id, createTicketTypeDto);
  }

  @Patch(':id/ticket-types/:ticketTypeId')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Update a ticket type' })
  updateTicketType(
    @Param('ticketTypeId') ticketTypeId: string,
    @Body() updateTicketTypeDto: UpdateTicketTypeDto,
  ) {
    return this.eventsService.updateTicketType(ticketTypeId, updateTicketTypeDto);
  }

  @Delete(':id/ticket-types/:ticketTypeId')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Delete a ticket type' })
  removeTicketType(
    @Param('id') eventId: string,
    @Param('ticketTypeId') ticketTypeId: string,
  ) {
    return this.eventsService.removeTicketType(eventId, ticketTypeId);
  }

  // --- EVENT DETAIL FLOW ---

  @Post(':id/like')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Toggle like on an event' })
  likeEvent(@Param('id') id: string, @Request() req: any) {
    return this.eventsService.likeEvent(id, req.user.id);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments for an event' })
  getComments(@Param('id') id: string) {
    return this.eventsService.getComments(id);
  }

  @Post(':id/comments')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Add a comment to an event' })
  addComment(
    @Param('id') id: string,
    @Body('body') body: string,
    @Request() req: any,
  ) {
    return this.eventsService.addComment(id, req.user.id, body);
  }

  @Post(':id/rsvp')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: "I'm Going — RSVP & fetch free ticket (internal events)" })
  rsvp(@Param('id') id: string, @Request() req: any) {
    return this.eventsService.rsvp(id, req.user.id);
  }

  @Get(':id/external-link')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Get external ticket provider link (external events only)' })
  getExternalLink(@Param('id') id: string) {
    return this.eventsService.getExternalLink(id);
  }

  // --- MULTI-SCHOOL EVENT CONNECTIONS ---

  @Post(':id/connect')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Request connection to another schools event' })
  requestConnection(
    @Param('id') eventId: string,
    @Body('requestingSchoolId') requestingSchoolId: string,
  ) {
    return this.eventsService.requestConnection(eventId, requestingSchoolId);
  }

  @Get(':id/connections/requests')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Get all connection requests for an event' })
  getConnectionRequests(@Param('id') eventId: string) {
    return this.eventsService.getConnectionRequests(eventId);
  }

  @Patch('connections/requests/:requestId')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Approve or reject a connection request' })
  respondToConnectionRequest(
    @Param('requestId') requestId: string,
    @Body('status') status: string,
  ) {
    return this.eventsService.respondToConnectionRequest(requestId, status);
  }
}
