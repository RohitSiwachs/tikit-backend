import { NestFactory } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── Global Prefix ──────────────────────────────────────
  app.setGlobalPrefix('v1');

  // ─── Global Pipes ──────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ─── Serialization (respects @Exclude() on entities) ───
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ─── CORS ──────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // ─── Swagger ───────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TiKit API')
    .setDescription('School event ticketing platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('v1/docs', app, document);

  // ─── Start ─────────────────────────────────────────────
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🎟️  TiKit API running on http://localhost:${port}/v1`);
  console.log(`📚 Swagger docs at http://localhost:${port}/v1/docs`);
}

bootstrap();
