import { NestFactory } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── Security headers ─────────────────────────────────
  app.use(helmet());

  // ─── Body size limit ──────────────────────────────────
  app.use(require('express').json({ limit: '1mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '1mb' }));

  // ─── Global Prefix ────────────────────────────────────
  app.setGlobalPrefix('v1');

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
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
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

  // ─── Start ────────────────────────────────────────────
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n🚀 TiKit API successfully started on port ${port}!`);
  console.log(`🏥 Health check at:   http://localhost:${port}/v1/health`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📚 Swagger docs at:   http://localhost:${port}/v1/docs\n`);
  }
}

bootstrap();
