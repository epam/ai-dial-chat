import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { EnvironmentVariables } from './config/environment.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  /*
   * Explicit deny-by-default CORS: this route is only ever navigated to as
   * an iframe `src` (validated by its own Referer allowlist), never fetched
   * cross-origin by script. Nest/Express already send no CORS headers
   * without this call, so this documents that posture as an intentional
   * policy rather than an accidental omission (design.md D17).
   */
  app.enableCors({ origin: false, credentials: false });
  /*
   * xFrameOptions and CSP are disabled - we don't know what the sandboxed app will need to do, and the sandbox proxy is already isolated from the rest of the system (and the user) by design. The sandbox proxy is not intended to be a general-purpose web server, and is only meant to serve MCP apps in a controlled environment.
   *
   * referrerPolicy is overridden from helmet's "no-referrer" default to
   * "strict-origin-when-cross-origin" (the modern browser default). The
   * sandboxed app's document inherits this page's referrer policy (it is
   * injected via document.write/srcdoc, not its own navigation), so
   * "no-referrer" strips the Referer header from every outbound request the
   * app makes - including map tile fetches - which some third-party
   * services reject as unidentifiable traffic.
   */
  app.use(
    helmet({
      contentSecurityPolicy: false,
      xFrameOptions: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
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
