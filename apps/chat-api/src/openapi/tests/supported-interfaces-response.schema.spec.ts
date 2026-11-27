import { VersioningType } from '@nestjs/common';
import type { OpenAPIObject, SchemaObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { DeploymentsController } from '../../deployments/deployments.controller';
import { DeploymentsService } from '../../deployments/deployments.service';
import { ModelCatalogController } from '../../models/catalog/model-catalog.controller';
import { ModelCatalogService } from '../../models/catalog/model-catalog.service';
import { createOpenApiDocument } from '../openapi.config';

describe('supported API discovery OpenAPI contract', () => {
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DeploymentsController, ModelCatalogController],
      providers: [
        { provide: DeploymentsService, useValue: {} },
        { provide: ModelCatalogService, useValue: {} },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
    document = createOpenApiDocument(app, 5000);
    await app.close();
  });

  it('documents Anthropic Messages as an optional detail capability', () => {
    const schema = document.components?.schemas?.[
      'DeploymentFeaturesDetailsDto'
    ] as SchemaObject;
    expect(schema.properties?.['anthropicMessages']).toMatchObject({
      type: 'boolean',
    });
    expect(schema.required ?? []).not.toContain('anthropicMessages');
    expect(schema.properties).not.toHaveProperty('interface_configs');
  });

  it('preserves the deployment details operation and response type', () => {
    const operation =
      document.paths['/api/v1/deployments/{deployment}/details']?.get;
    expect(operation?.operationId).toBe('getDeploymentDetails');
    expect(operation?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/DeploymentDetailsDto' },
        },
      },
    });
  });

  it('documents only optional normalized names on catalog entries', () => {
    const schema = document.components?.schemas?.[
      'ModelCatalogEntryDto'
    ] as SchemaObject;
    expect(schema.properties?.['supportedInterfaces']).toMatchObject({
      type: 'array',
      items: { type: 'string' },
    });
    expect(schema.required ?? []).not.toContain('supportedInterfaces');
    expect(schema.properties).not.toHaveProperty('interface_configs');
    expect(schema.properties).not.toHaveProperty('default_headers');
  });

  it.each([
    [
      '/api/v1/model-catalog',
      'listModelCatalog',
      'ModelCatalogListResponseDto',
    ],
    [
      '/api/v1/model-catalog/{modelName}',
      'getModelCatalogEntry',
      'ModelCatalogEntryDto',
    ],
  ])(
    'preserves the %s catalog operation and typed response',
    (path, operationId, type) => {
      const operation = document.paths[path]?.get;
      expect(operation?.operationId).toBe(operationId);
      expect(operation?.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/' + type },
          },
        },
      });
    },
  );
});
