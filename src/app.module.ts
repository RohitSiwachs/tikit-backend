import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { databaseConfig, jwtConfig, s3Config } from './config/index';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

// Feature Modules
import { EventsModule } from './events/events.module';
import { TicketsModule } from './tickets/tickets.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SchoolsModule } from './schools/schools.module';
import { UsersModule } from './users/users.module';
import { CardsModule } from './cards/cards.module';
import { AdminModule } from './admin/admin.module';
import { PrismaModule } from './prisma/prisma.module';
import { PostsModule } from './posts/posts.module';
import { ClassesModule } from './classes/classes.module';
import { SegmentsModule } from './segments/segments.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ScannerModule } from './scanner/scanner.module';
import { WalletModule } from './wallet/wallet.module';
import { GatewayModule } from './gateway/gateway.module';
import { UploadModule } from './upload/upload.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    // ─── Global Config ─────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, s3Config],
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    // ─── Scheduler (cron jobs) ─────────────────────────────
    ScheduleModule.forRoot(),

    // ─── Rate Limiting ─────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,   // 1 minute window
        limit: 60,    // 60 requests per minute (general)
      },
    ]),

    // ─── Feature Modules ───────────────────────────────────
    AuthModule,
    EventsModule,
    TicketsModule,
    NotificationsModule,
    PrismaModule,
    SchoolsModule,
    UsersModule,
    CardsModule,
    AdminModule,
    PostsModule,
    ClassesModule,
    SegmentsModule,
    CampaignsModule,
    ScannerModule,
    WalletModule,
    GatewayModule,
    UploadModule,
    VouchersModule,
  ],
  controllers: [AppController],
  providers: [
    // Global rate limiter (applied unless @SkipThrottle())
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global JWT guard — all routes require auth unless marked @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
