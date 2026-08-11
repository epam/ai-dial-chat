import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { EnvironmentVariables } from './config/environment.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  /*
   * xFrameOptions is disabled: this app is meant to be iframed cross-origin
   * by the chat host, so X-Frame-Options: SAMEORIGIN would break its only use.
   * The sandbox route sets its own per-response CSP in SandboxController via
   * res.set('Content-Security-Policy', ...) which takes precedence over this
   * default helmet CSP, so a restrictive default here is safe and still allows
   * CodeQL to confirm CSP enforcement is not fully disabled.
   */
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'none'"],
        },
      },
      xFrameOptions: false,
    }),
  );
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
