import { Module } from '@nestjs/common';
import { NotificationTriggersService } from './notification-triggers.service';
import { NotificationTriggersController } from './notification-triggers.controller';

@Module({
  controllers: [NotificationTriggersController],
  providers: [NotificationTriggersService],
  exports: [NotificationTriggersService],
})
export class NotificationTriggersModule {}
