import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { EnvironmentVariables } from './config/environment.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  /*
   * xFrameOptions and contentSecurityPolicy are disabled here: this app is
   * meant to be iframed cross-origin by the chat host, and the sandbox
   * route sets its own per-response CSP (`SandboxController`/`SandboxService`)
   * with a per-request nonce — a static default-on CSP or X-Frame-Options
   * would either conflict with it or block the very embedding this app exists for.
   */
  app.use(helmet({ contentSecurityPolicy: false, xFrameOptions: false }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const configService = app.get(ConfigService<EnvironmentVariables, true>);
  const port = configService.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`MCP Apps sandbox proxy is running on: http://localhost:${port}`);
}

bootstrap();
