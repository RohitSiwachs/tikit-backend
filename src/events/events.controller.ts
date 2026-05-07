import { Controller, Get, Post, Patch, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EventsService } from './events.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('api/v1/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles(UserRole.KAR_ADMIN, UserRole.EVENTANSVARIG, UserRole.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Create an event (multi-step form)' })
  create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: { id: string; school_id: string },
  ) {
    return this.eventsService.create(dto, user.id, user.school_id);
  }

  @Get()
  @ApiOperation({ summary: 'List events with filters (Allt/Klubb/Sport/Gasque tabs)' })
  findAll(
    @Query('category') category?: string,
    @Query('school_id') school_id?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventsService.findAll({
      category,
      school_id,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event detail (event page with ticket types)' })
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id/sold-out')
  @Roles(UserRole.KAR_ADMIN, UserRole.EVENTANSVARIG, UserRole.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Toggle sold-out status' })
  toggleSoldOut(@Param('id') id: string, @Body('is_sold_out') isSoldOut: boolean) {
    return this.eventsService.toggleSoldOut(id, isSoldOut);
  }

  @Get(':id/checkin/stats')
  @Roles(UserRole.SCANNER, UserRole.KAR_ADMIN, UserRole.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Get live check-in stats for scanner dashboard' })
  getCheckinStats(@Param('id') id: string) {
    return this.eventsService.getCheckinStats(id);
  }
}
