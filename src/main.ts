import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  ClassSerializerInterceptor,
  RequestMethod,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);

  // ─── Security headers ─────────────────────────────────
  app.use(helmet());

  // ─── Body size limit ──────────────────────────────────
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // ─── Global Prefix ────────────────────────────────────
  app.setGlobalPrefix('v1', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  // ─── Global Pipes ─────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ─── Global Filters ───────────────────────────────────
  app.useGlobalFilters(new PrismaExceptionFilter());

  // ─── Serialization ────────────────────────────────────
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ─── CORS ─────────────────────────────────────────────
  // In production CORS_ORIGIN must be set (enforced by env validation).
  // Multiple allowed origins can be comma-separated: https://app.tikit.se,https://admin.tikit.se
  const rawOrigins = process.env.CORS_ORIGIN || '';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // ─── Swagger (disabled in production) ─────────────────
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('TiKit API')
      .setDescription('School event ticketing platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('v1/docs', app, document);
  }

  // ─── Graceful shutdown ────────────────────────────────
  // NestJS will call OnModuleDestroy on all providers (including PrismaService)
  // before the process exits. Gives in-flight requests up to 10s to complete.
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  if (process.env.NODE_ENV !== 'production') {
    logger.log(`====================================================`);
    logger.log(`TiKit API running on port ${port} [${process.env.NODE_ENV}]`);
    logger.log(`====================================================`);
    logger.log(`1. Localhost Swagger:   http://localhost:${port}/v1/docs`);
    logger.log(
      `2. Render Live Swagger: https://tikit-backend.onrender.com/v1/docs`,
    );
    logger.log(`3. Backend Localhost:   http://localhost:${port}`);
    logger.log(`4. Health API:          http://localhost:${port}/v1/health`);
    logger.log(`5. Render Live Link:    https://tikit-backend.onrender.com`);
    logger.log(
      `6. BullMQ Dashboard:    http://localhost:${port}/v1/admin/queues`,
    );
    logger.log(`====================================================`);
  } else {
    logger.log(`TiKit API running on port ${port} [${process.env.NODE_ENV}]`);
  }
}

bootstrap();
