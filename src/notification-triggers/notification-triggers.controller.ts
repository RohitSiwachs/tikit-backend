import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Request,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationTriggersService } from './notification-triggers.service';
import { UpsertNotificationTriggerDto } from './dto/notification-trigger.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

@ApiTags('notification-triggers')
@ApiBearerAuth()
@Controller('notification-triggers')
export class NotificationTriggersController {
  constructor(
    private readonly notificationTriggersService: NotificationTriggersService,
  ) {}

  @Get(':eventId')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({
    summary: 'List all notification copy overrides for an event',
  })
  findByEvent(@Param('eventId') eventId: string) {
    return this.notificationTriggersService.findByEvent(eventId);
  }

  @Put(':eventId')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({
    summary: 'Create or update a notification copy override for an event',
  })
  upsert(
    @Param('eventId') eventId: string,
    @Body() dto: UpsertNotificationTriggerDto,
    @Request() req: any,
  ) {
    const schoolId =
      req.user.role === Role.TIKIT_ADMIN
        ? (dto.schoolId ?? req.user.schoolId)
        : req.user.schoolId;

    if (!schoolId) {
      throw new BadRequestException(
        'schoolId is required — provide it in the body (TIKIT_ADMIN) or log in as a school user',
      );
    }

    return this.notificationTriggersService.upsert(
      schoolId,
      eventId,
      dto.triggerKey,
      dto.title,
      dto.body,
    );
  }

  @Delete(':eventId')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Delete a notification copy override' })
  @ApiQuery({ name: 'triggerKey', required: true, type: String })
  @ApiQuery({
    name: 'schoolId',
    required: false,
    type: String,
    description: 'TIKIT_ADMIN only',
  })
  deleteOne(
    @Param('eventId') eventId: string,
    @Query('triggerKey') triggerKey: string,
    @Query('schoolId') schoolIdQuery: string | undefined,
    @Request() req: any,
  ) {
    if (!triggerKey) {
      throw new BadRequestException('triggerKey query param is required');
    }

    const schoolId =
      req.user.role === Role.TIKIT_ADMIN
        ? (schoolIdQuery ?? req.user.schoolId)
        : req.user.schoolId;

    if (!schoolId) {
      throw new BadRequestException('schoolId could not be resolved');
    }

    return this.notificationTriggersService.deleteOne(
      schoolId,
      eventId,
      triggerKey,
    );
  }
}
