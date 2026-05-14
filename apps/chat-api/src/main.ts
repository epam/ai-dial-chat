import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableVersioning({ type: VersioningType.URI });

  // Security headers middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const globalPrefix = process.env.API_PREFIX || 'api';

  app.setGlobalPrefix(globalPrefix);
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4207',
    credentials: true,
  });

  const port = process.env.PORT || 3005;
  await app.listen(port);
  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Chat API')
    .setDescription(
      'REST API for the chat application. Provides endpoints for theme configuration, authentication, and management. ' +
        'All endpoints return appropriate HTTP status codes (200, 400, 401, 403, 404, 502, 503) with descriptive error messages.',
    )
    .setVersion('1.0.0')
    .addServer(`http://localhost:${port}`, 'Local development')
    .addTag('health', 'Health check and application status')
    .addTag('themes', 'Theme configuration and icon management')
    .addTag('auth', 'Authentication and session management')
    .addTag('deployments', 'List and inspect available AI DIAL deployments')
    .addTag('chat', 'Chat completion proxy to DIAL Core')
    .addCookieAuth('session')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(
    `📚 Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
}

bootstrap();
