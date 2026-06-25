import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import {
  createOpenApiConfig,
  openApiDocumentOptions,
} from './openapi/openapi.config';

declare const module: {
  hot?: { accept: () => void; dispose: (cb: () => void) => void };
};

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
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          // unpkg.com required for PDF.js worker (pdfjs-dist/build/pdf.worker.min.mjs)
          scriptSrc: ["'self'", 'https://unpkg.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
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

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );

  if (process.env['NODE_ENV'] !== 'production') {
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

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}

bootstrap();
