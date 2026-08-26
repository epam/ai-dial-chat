import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { EnvironmentVariables } from './config/environment.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  /*
   * xFrameOptions and CSP are disabled - we don't know what the sandboxed app will need to do, and the sandbox proxy is already isolated from the rest of the system (and the user) by design. The sandbox proxy is not intended to be a general-purpose web server, and is only meant to serve MCP apps in a controlled environment.
   */
  app.use(
    helmet({
      contentSecurityPolicy: false,
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
