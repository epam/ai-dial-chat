import {
  BadRequestException,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import type { ValidationError } from 'class-validator';
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

const validationLogger = new Logger('ValidationPipe');

/*
 * Flattens nested `ValidationError`s into `{ property, constraints }` pairs
 * for debug logging. Deliberately never includes `.value` — class-validator
 * attaches the raw submitted value to each error, and some validated DTOs
 * carry secrets (e.g. `apiKey`, OAuth `code`), which must never reach logs.
 */
const flattenValidationErrors = (
  errors: ValidationError[],
  prefix = '',
): Array<{ property: string; constraints?: Record<string, string> }> =>
  errors.flatMap((error) => {
    const property = prefix ? `${prefix}.${error.property}` : error.property;
    const own = error.constraints
      ? [{ property, constraints: error.constraints }]
      : [];
    const nested = error.children?.length
      ? flattenValidationErrors(error.children, property)
      : [];
    return [...own, ...nested];
  });

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
      exceptionFactory: (errors) => {
        const flattened = flattenValidationErrors(errors);
        validationLogger.warn(
          `Request body validation failed: ${JSON.stringify(flattened)}`,
        );
        return new BadRequestException(
          flattened.flatMap(({ constraints }) =>
            Object.values(constraints ?? {}),
          ),
        );
      },
    }),
  );
  const globalPrefix = process.env.API_PREFIX || 'api';

  app.setGlobalPrefix(globalPrefix);
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4207',
    credentials: true,
    exposedHeaders: ['X-CSRF-Token', 'X-DIAL-CLIENT-CHANNEL-ID'],
  });

  const port = process.env.PORT || 5000;
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
