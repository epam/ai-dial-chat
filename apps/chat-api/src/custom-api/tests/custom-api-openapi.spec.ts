import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { openApiDocumentOptions } from '../../openapi/openapi.config';
import { CustomApiAdmissionService } from '../custom-api-admission.service';
import { CustomApiRegistryService } from '../custom-api-registry.service';
import { CustomApiController } from '../custom-api.controller';
import { CustomApiService } from '../custom-api.service';

/*
 * Builds the slice of the real OpenAPI document this controller contributes,
 * using the exact app-level setup (global prefix, URI versioning,
 * operationIdFactory) main.ts/openapi-spec.ts apply, scoped to just this
 * controller so the test stays fast and does not need the whole AppModule's
 * environment/DI graph.
 */
const buildDocument = async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [CustomApiController],
    providers: [
      { provide: CustomApiRegistryService, useValue: { get: () => undefined } },
      { provide: CustomApiService, useValue: {} },
      { provide: CustomApiAdmissionService, useValue: {} },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const document = SwaggerModule.createDocument(
    app,
    {
      openapi: '3.0.0',
      info: { title: 'test', version: '1.0.0' },
    },
    openApiDocumentOptions,
  );
  await app.close();
  return document;
};

describe('custom API OpenAPI contract', () => {
  const METHODS = ['get', 'post', 'put', 'delete'] as const;

  it('documents GET, POST, PUT and DELETE at the versioned path, never PATCH or HEAD', async () => {
    const document = await buildDocument();
    const pathItem = document.paths['/api/v1/custom-api/{id}'];

    expect(pathItem).toBeDefined();
    for (const method of METHODS) expect(pathItem?.[method]).toBeDefined();
    expect(pathItem?.patch).toBeUndefined();
    expect(pathItem?.head).toBeUndefined();
  });

  it.each([
    ['get', 'getCustomApiOperation'],
    ['post', 'postCustomApiOperation'],
    ['put', 'putCustomApiOperation'],
    ['delete', 'deleteCustomApiOperation'],
  ] as const)(
    'sets the %s operationId to %s (operationIdFactory uses the handler name)',
    async (method, operationId) => {
      const document = await buildDocument();
      const operation = document.paths['/api/v1/custom-api/{id}']?.[method];
      expect(operation?.operationId).toBe(operationId);
    },
  );

  it.each(METHODS)(
    'documents the path ID parameter and no query parameters on %s',
    async (method) => {
      const document = await buildDocument();
      const operation = document.paths['/api/v1/custom-api/{id}']?.[method];

      const pathParams =
        operation?.parameters?.filter((p) => 'in' in p && p.in === 'path') ??
        [];
      const queryParams =
        operation?.parameters?.filter((p) => 'in' in p && p.in === 'query') ??
        [];

      expect(pathParams).toHaveLength(1);
      expect(pathParams[0]).toMatchObject({ name: 'id', required: true });
      expect(queryParams).toHaveLength(0);
    },
  );

  it('documents an optional free-form JSON body on POST and PUT only', async () => {
    const document = await buildDocument();
    const pathItem = document.paths['/api/v1/custom-api/{id}'];

    for (const method of ['post', 'put'] as const) {
      const body = pathItem?.[method]?.requestBody as
        | {
            required?: boolean;
            content?: Record<string, { schema?: unknown }>;
          }
        | undefined;
      expect(body?.required).toBe(false);
      expect(body?.content?.['application/json']?.schema).toMatchObject({
        type: 'object',
        additionalProperties: true,
      });
    }
    expect(pathItem?.get?.requestBody).toBeUndefined();
    expect(pathItem?.delete?.requestBody).toBeUndefined();
  });

  it('documents a 200 response with a schema (not description-only)', async () => {
    const document = await buildDocument();
    const operation = document.paths['/api/v1/custom-api/{id}']?.get;
    const ok = operation?.responses?.['200'];

    expect(ok).toBeDefined();
    const schemaRef = (ok as { content?: Record<string, { schema?: unknown }> })
      .content?.['application/json']?.schema;
    expect(schemaRef).toBeDefined();
  });

  it.each(['400', '401', '404', '405', '429', '502', '503', '504'])(
    'documents the %s response',
    async (status) => {
      const document = await buildDocument();
      const operation = document.paths['/api/v1/custom-api/{id}']?.get;
      expect(operation?.responses?.[status]).toBeDefined();
    },
  );

  it('documents the opaque data envelope as a free-form object, not a bare any', async () => {
    const document = await buildDocument();
    const schema = document.components?.schemas?.['CustomApiResponseDto'] as
      { properties?: Record<string, unknown> } | undefined;

    expect(schema?.properties?.['data']).toMatchObject({
      type: 'object',
      additionalProperties: true,
    });
  });
});
