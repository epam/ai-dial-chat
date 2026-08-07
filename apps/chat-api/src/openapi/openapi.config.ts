import { DocumentBuilder, type SwaggerDocumentOptions } from '@nestjs/swagger';

export const createOpenApiConfig = (port: string | number) =>
  new DocumentBuilder()
    .setTitle('Chat API')
    .setDescription(
      'REST API for the chat application. Provides endpoints for theme configuration, authentication, and management. ' +
        'All endpoints return appropriate HTTP status codes (200, 400, 401, 403, 404, 502, 503) with descriptive error messages.',
    )
    .setVersion('1.0.0')
    .addServer(`http://localhost:${port}`, 'Local development')
    .addTag('health', 'Health check and application status')
    .addTag('themes', 'Theme configuration and icon management')
    .addTag('auth', 'Authentication and session management')
    .addTag('chat', 'Chat completion proxy to DIAL Core')
    .addTag('rate', 'Submit assistant message ratings to DIAL Core')
    .addTag(
      'deployments',
      'List deployments available to the authenticated user',
    )
    .addCookieAuth('session')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();

export const openApiDocumentOptions: SwaggerDocumentOptions = {
  operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
};
