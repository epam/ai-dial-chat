import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * OpenAPI vendor extension `@Public()` stamps on every operation it covers.
 * `createOpenApiDocument` replaces it with `security: []` (opting the
 * operation out of the document-level session/bearer requirement) and strips
 * the marker, so it never reaches the published spec.
 */
export const OPENAPI_PUBLIC_EXTENSION = 'x-public';

/**
 * Marks a handler or controller as reachable without authentication: the
 * global `SessionGuard` skips it, and the OpenAPI document declares it with
 * no security requirement.
 */
export const Public = () =>
  applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    ApiExtension(OPENAPI_PUBLIC_EXTENSION, true),
  );
