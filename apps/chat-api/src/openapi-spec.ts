import 'reflect-metadata';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import {
  createOpenApiConfig,
  openApiDocumentOptions,
} from './openapi/openapi.config';

const workspaceRoot = join(__dirname, '..', '..', '..');
const outputPath = join(workspaceRoot, 'libs/chat-api-client/openapi.json');

const ensureOpenApiEnv = () => {
  process.env['DIAL_CORE_URL'] ??= 'http://localhost:8080';
  process.env['AUTH_SESSION_SECRET'] ??=
    '0000000000000000000000000000000000000000000000000000000000000000';
  process.env['AUTH_CALLBACK_BASE_URL'] ??= 'http://localhost:5000';
  process.env['AUTH_POST_LOGOUT_REDIRECT_URI'] ??= 'http://localhost:5000';
  process.env['AUTH_OKTA_CLIENT_ID'] ??= 'openapi-generator';
  process.env['AUTH_OKTA_CLIENT_SECRET'] ??= 'openapi-generator';
  process.env['AUTH_OKTA_ISSUER'] ??= 'http://localhost:5000';
  process.env['AUTH_OKTA_NAME'] ??= 'Local';
};

const generateOpenApiSpec = async () => {
  ensureOpenApiEnv();

  const app = await NestFactory.create(AppModule, { logger: false });
  const globalPrefix = process.env['API_PREFIX'] || 'api';
  const port = process.env['PORT'] || 5000;

  app.setGlobalPrefix(globalPrefix);
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const document = SwaggerModule.createDocument(
    app,
    createOpenApiConfig(port),
    openApiDocumentOptions,
  );

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
};

generateOpenApiSpec().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
