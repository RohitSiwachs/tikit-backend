import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationTriggersModule } from '../notification-triggers/notification-triggers.module';
import { NOTIFICATIONS_QUEUE } from './notifications.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
    BullBoardModule.forFeature({
      name: NOTIFICATIONS_QUEUE,
      adapter: BullMQAdapter,
    }),
    NotificationTriggersModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
