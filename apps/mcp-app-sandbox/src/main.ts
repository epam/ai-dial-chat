import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3100;
  await app.listen(port);
  Logger.log(`MCP Apps sandbox proxy is running on: http://localhost:${port}`);
}

bootstrap();
