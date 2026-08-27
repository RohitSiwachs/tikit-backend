import { Controller, Post, Body, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/notification.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Send targeted push notifications' })
  sendToSegment(@Body() dto: SendNotificationDto, @Request() req: any) {
    return this.notificationsService.sendToSegment(dto, req.user);
  }
}
