import { VersioningType } from '@nestjs/common';
import type { OpenAPIObject, SchemaObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { DeploymentsService } from '../../deployments/deployments.service';
import { UserLimitsController } from '../../deployments/user-limits.controller';
import { createOpenApiDocument } from '../openapi.config';

const buildDocument = async (): Promise<OpenAPIObject> => {
  const moduleRef = await Test.createTestingModule({
    controllers: [UserLimitsController],
    providers: [{ provide: DeploymentsService, useValue: {} }],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  await app.init();
  const document = createOpenApiDocument(app, 5000);
  await app.close();
  return document;
};

describe('UserLimitStatsResponseDto OpenAPI schema', () => {
  let schemas: NonNullable<OpenAPIObject['components']>['schemas'];
  let document: OpenAPIObject;

  beforeAll(async () => {
    document = await buildDocument();
    schemas = document.components?.schemas ?? {};
  });

  const schema = (name: string): SchemaObject =>
    (schemas ?? {})[name] as SchemaObject;

  it('describes a budget with required cost object, policy and day/month windows', () => {
    const budget = schema('BudgetStatsDto');

    expect(budget).toBeTruthy();
    expect(budget.required).toEqual(
      expect.arrayContaining(['costObject', 'policy', 'day', 'month']),
    );
    expect(budget.required).not.toContain('priority');
    expect(budget.properties?.['costObject']).toMatchObject({
      type: 'string',
    });
    expect(budget.properties?.['policy']).toMatchObject({ type: 'string' });
    expect(budget.properties?.['priority']).toMatchObject({
      type: 'integer',
    });
  });

  it('reuses LimitStatsDto for the day and month budget windows', () => {
    const budget = schema('BudgetStatsDto');

    /* A described `$ref` is emitted as a single-entry `allOf`, as for the
     * top-level `*CostStats`; the generator resolves it to `LimitStatsDto`. */
    for (const window of ['day', 'month']) {
      expect(budget.properties?.[window]).toMatchObject({
        allOf: [{ $ref: '#/components/schemas/LimitStatsDto' }],
      });
    }
  });

  it('exposes budgets as an optional array of BudgetStatsDto', () => {
    const response = schema('UserLimitStatsResponseDto');

    expect(response.properties?.['budgets']).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/BudgetStatsDto' },
    });
    expect(response.required ?? []).not.toContain('budgets');
  });

  it.each(['/api/v1/user/limits', '/api/v1/user/usage'])(
    'returns UserLimitStatsResponseDto from GET %s',
    (path) => {
      expect(document.paths[path]?.get?.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UserLimitStatsResponseDto' },
          },
        },
      });
    },
  );
});
