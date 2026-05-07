import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { databaseConfig, jwtConfig, s3Config } from './config/index.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';

// Feature Modules
import { EventsModule } from './events/events.module.js';
import { FeedModule } from './feed/feed.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { WalletModule } from './wallet/wallet.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { UploadModule } from './upload/upload.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { GatewayModule } from './gateway/gateway.module.js';

// Entities
import { School } from './entities/school.entity.js';
import { User } from './entities/user.entity.js';
import { Venue } from './entities/venue.entity.js';
import { Event } from './entities/event.entity.js';
import { TicketType } from './entities/ticket-type.entity.js';
import { Ticket } from './entities/ticket.entity.js';
import { Voucher } from './entities/voucher.entity.js';
import { CheckIn } from './entities/check-in.entity.js';
import { MembershipCard } from './entities/membership-card.entity.js';
import { FeedPost } from './entities/feed-post.entity.js';
import { Comment } from './entities/comment.entity.js';
import { Poll } from './entities/poll.entity.js';
import { PollOption } from './entities/poll-option.entity.js';
import { PollVote } from './entities/poll-vote.entity.js';
import { Follow } from './entities/follow.entity.js';
import { PostLike } from './entities/post-like.entity.js';
import { Notification } from './entities/notification.entity.js';

@Module({
  imports: [
    // ─── Global Config ─────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, s3Config],
      envFilePath: '.env',
    }),

    // ─── TypeORM ───────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        entities: [
          School,
          User,
          Venue,
          Event,
          TicketType,
          Ticket,
          Voucher,
          CheckIn,
          MembershipCard,
          FeedPost,
          Comment,
          Poll,
          PollOption,
          PollVote,
          Follow,
          PostLike,
          Notification,
        ],
        synchronize: config.get<boolean>('database.synchronize'),
        logging: config.get<boolean>('database.logging'),
      }),
    }),

    // ─── Feature Modules ───────────────────────────────────
    AuthModule,
    EventsModule,
    FeedModule,
    TicketsModule,
    WalletModule,
    ProfileModule,
    UploadModule,
    NotificationsModule,
    GatewayModule,
  ],
  providers: [
    // Global JWT guard — all routes require auth unless marked @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
