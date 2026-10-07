import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  type SwaggerDocumentOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { DEFAULT_SESSION_COOKIE_NAME } from '../auth/cookies/cookie-options';
import { OPENAPI_PUBLIC_EXTENSION } from '../common/decorators/public.decorator';

/** Security scheme key for the encrypted session cookie. */
export const SESSION_SECURITY_SCHEME = 'session';
/** Security scheme key for a forwarded `Authorization: Bearer` token. */
export const BEARER_SECURITY_SCHEME = 'bearer';

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
    .addTag(
      'custom-api',
      'Deployment-configured custom Core API operations (CUSTOM_CORE_API_CONFIG)',
    )
    .addCookieAuth(
      DEFAULT_SESSION_COOKIE_NAME,
      {
        type: 'apiKey',
        description:
          'Encrypted session cookie set by the OIDC login callback. The name is configurable ' +
          '(AUTH_SESSION_COOKIE_NAME, default shown); the `__Host-` prefix is dropped when ' +
          'AUTH_COOKIE_SECURE=false, and a large session is split across numbered chunk cookies. ' +
          'Cookie-authenticated mutating requests also require the X-CSRF-Token header.',
      },
      SESSION_SECURITY_SCHEME,
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      BEARER_SECURITY_SCHEME,
    )
    // Two requirement objects = alternatives: a session cookie OR a bearer token.
    .addSecurityRequirements(SESSION_SECURITY_SCHEME)
    .addSecurityRequirements(BEARER_SECURITY_SCHEME)
    .build();

export const openApiDocumentOptions: SwaggerDocumentOptions = {
  operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
};

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

/**
 * Opts every operation that `@Public()` marked out of the document-level
 * security requirement (`security: []`) and strips the marker extension.
 * Mutates and returns the document.
 */
export const applyPublicOperationSecurity = (
  document: OpenAPIObject,
): OpenAPIObject => {
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as
        (Record<string, unknown> & { security?: unknown }) | undefined;
      if (operation == null || !(OPENAPI_PUBLIC_EXTENSION in operation)) {
        continue;
      }
      const isPublic = operation[OPENAPI_PUBLIC_EXTENSION] === true;
      delete operation[OPENAPI_PUBLIC_EXTENSION];
      if (isPublic) {
        operation.security = [];
      }
    }
  }
  return document;
};

/**
 * Builds the Chat API OpenAPI document — shared by the Swagger UI in
 * `main.ts` and the committed spec generator `openapi-spec.ts`, so both
 * carry the same security requirements.
 */
export const createOpenApiDocument = (
  app: INestApplication,
  port: string | number,
): OpenAPIObject =>
  applyPublicOperationSecurity(
    SwaggerModule.createDocument(
      app,
      createOpenApiConfig(port),
      openApiDocumentOptions,
    ),
  );
