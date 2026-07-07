import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

// Queries slower than this threshold are logged as warnings in production.
// Tune downward once baseline performance is established.
const SLOW_QUERY_THRESHOLD_MS = 500;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        // Emit query events so the slow-query hook below can inspect duration.
        // In production only errors are printed to stdout; slow queries go to logger.warn.
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
      ],
    });

    // Slow query warning: fires for every query that exceeds the threshold.
    // The query text is truncated in production logs to avoid leaking user data.
    (
      this as unknown as PrismaClient & {
        $on(event: 'query', cb: (e: Prisma.QueryEvent) => void): void;
      }
    ).$on('query', (e: Prisma.QueryEvent) => {
      if (e.duration >= SLOW_QUERY_THRESHOLD_MS) {
        this.logger.warn(
          `Slow query (${e.duration}ms): ${e.query.slice(0, 200)}`,
        );
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  // Ensures DB connections are cleanly closed when the app receives SIGTERM.
  // Without this, in-flight Prisma transactions are killed mid-write on rolling deploys.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
