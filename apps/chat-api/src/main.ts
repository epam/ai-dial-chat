import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import 'reflect-metadata';
import { AppModule } from './app/app.module';
import { buildFrameSrcDirective } from './config/csp';
import { EnvironmentVariables } from './config/environment.config';
import {
  createOpenApiConfig,
  openApiDocumentOptions,
} from './openapi/openapi.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env['NODE_ENV'] === 'production'
        ? ['log', 'error', 'warn']
        : ['log', 'error', 'warn', 'debug'],
  });

  app.use(cookieParser());

  app.enableVersioning({ type: VersioningType.URI });

  const configService = app.get(ConfigService<EnvironmentVariables, true>);
  const allowedIframeOrigins = configService.get('ALLOWED_IFRAME_ORIGINS', {
    infer: true,
  });

  // Security headers middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          scriptSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          frameSrc: buildFrameSrcDirective(allowedIframeOrigins),
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
    exposedHeaders: ['X-CSRF-Token'],
  });

  const port = process.env.PORT || 3005;
  await app.listen(port);

  Logger.log(
    `Application is running on: http://localhost:${port}/${globalPrefix}`,
  );

  const shouldExposeSwagger = process.env['NODE_ENV'] !== 'production';
  if (shouldExposeSwagger) {
    const document = SwaggerModule.createDocument(
      app,
      createOpenApiConfig(port),
      openApiDocumentOptions,
    );
    SwaggerModule.setup('api/docs', app, document);
    Logger.log(
      `📚 Swagger documentation available at: http://localhost:${port}/api/docs`,
    );
  }
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    'Failed to start application',
    error instanceof Error ? error.stack : error,
  );
  process.exitCode = 1;
});
