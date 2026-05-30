import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  // Ensures DB connections are cleanly closed when the app receives SIGTERM.
  // Without this, in-flight Prisma transactions are killed mid-write on rolling deploys.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
