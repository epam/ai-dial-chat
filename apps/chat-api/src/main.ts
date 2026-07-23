import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import 'reflect-metadata';
import { AppModule } from './app/app.module';
import { createHelmetOptions } from './config/csp';
import { EnvironmentVariables } from './config/environment.config';
import { resolveLogLevels } from './config/log-levels';
import {
  createOpenApiConfig,
  openApiDocumentOptions,
} from './openapi/openapi.config';

async function bootstrap() {
  const runtimeEnvironment = process.env;
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: resolveLogLevels(
      runtimeEnvironment['NODE_ENV'],
      runtimeEnvironment['LOG_LEVEL'],
    ),
  });

  app.use(cookieParser());

  app.enableVersioning({ type: VersioningType.URI });

  const configService = app.get(ConfigService<EnvironmentVariables, true>);
  const allowedIframeOrigins = configService.get('ALLOWED_IFRAME_ORIGINS', {
    infer: true,
  });

  app.useBodyParser('json', {
    limit: configService.get('CONVERSATION_BODY_SIZE_LIMIT_BYTES', {
      infer: true,
    }),
  });

  // Security headers middleware
  app.use(helmet(createHelmetOptions(allowedIframeOrigins ?? [])));

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
    exposedHeaders: ['X-CSRF-Token', 'X-DIAL-CLIENT-CHANNEL-ID'],
  });

  const port = process.env.PORT || 3005;
  await app.listen(port);

  Logger.log(
    `Application is running on: http://localhost:${port}/${globalPrefix}`,
  );

  const shouldExposeSwagger = runtimeEnvironment['NODE_ENV'] !== 'production';
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
