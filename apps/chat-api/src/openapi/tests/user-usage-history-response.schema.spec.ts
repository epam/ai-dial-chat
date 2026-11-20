import { VersioningType } from '@nestjs/common';
import type { OpenAPIObject, SchemaObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { UsageHistoryService } from '../../usage-history/usage-history.service';
import { UserUsageHistoryController } from '../../usage-history/user-usage-history.controller';
import { createOpenApiDocument } from '../openapi.config';

interface QueryParameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: unknown;
}

const buildDocument = async (): Promise<OpenAPIObject> => {
  const moduleRef = await Test.createTestingModule({
    controllers: [UserUsageHistoryController],
    providers: [{ provide: UsageHistoryService, useValue: {} }],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  await app.init();
  const document = createOpenApiDocument(app, 5000);
  await app.close();
  return document;
};

describe('UserUsageHistoryResponseDto OpenAPI schema', () => {
  let document: OpenAPIObject;
  let schemas: Record<string, SchemaObject>;

  beforeAll(async () => {
    document = await buildDocument();
    schemas = (document.components?.schemas ?? {}) as Record<
      string,
      SchemaObject
    >;
  });

  const operation = () => document.paths['/api/v1/user/usage/history']?.get;

  it('exposes GET /api/v1/user/usage/history as getUserUsageHistory under the user tag', () => {
    expect(operation()?.operationId).toBe('getUserUsageHistory');
    expect(operation()?.tags).toEqual(['user']);
    expect(Object.keys(operation()?.responses ?? {}).sort()).toEqual([
      '200',
      '400',
      '401',
    ]);
  });

  it('requires a period query parameter typed by the named UsageHistoryPeriod enum', () => {
    const parameters = (operation()?.parameters ?? []) as QueryParameter[];

    expect(parameters.map((parameter) => parameter.name)).toEqual([
      'period',
      'costObject',
      'policy',
    ]);
    expect(parameters[0]).toMatchObject({ in: 'query', required: true });
    expect(parameters[0].schema).toMatchObject({
      $ref: '#/components/schemas/UsageHistoryPeriod',
    });
    expect(schemas['UsageHistoryPeriod']).toMatchObject({
      type: 'string',
      enum: ['today', 'week', 'month'],
    });
  });

  it('accepts an optional budget as costObject and policy string query parameters', () => {
    const parameters = (operation()?.parameters ?? []) as QueryParameter[];

    for (const name of ['costObject', 'policy']) {
      expect(
        parameters.find((parameter) => parameter.name === name),
      ).toMatchObject({
        in: 'query',
        required: false,
        schema: { type: 'string', maxLength: 1024 },
      });
    }
  });

  it('returns UserUsageHistoryResponseDto with available as the only required field', () => {
    const response = schemas['UserUsageHistoryResponseDto'];

    expect(
      operation()?.responses?.['200'] as { content?: unknown },
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UserUsageHistoryResponseDto' },
        },
      },
    });
    expect(response.required).toEqual(['available']);
    expect(Object.keys(response.properties ?? {}).sort()).toEqual([
      'available',
      'budget',
      'byClient',
      'byModel',
      'currency',
      'daily',
      'period',
      'reason',
      'totals',
    ]);
  });

  it('types the unavailable reason as the named UsageHistoryUnavailableReason enum', () => {
    expect(
      schemas['UserUsageHistoryResponseDto'].properties?.['reason'],
    ).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/UsageHistoryUnavailableReason' }],
    });
    expect(schemas['UsageHistoryUnavailableReason']).toMatchObject({
      type: 'string',
      enum: [
        'not_configured',
        'unavailable',
        'forbidden',
        'budget_unsupported',
      ],
    });
  });

  it('echoes the budget as UsageHistoryBudgetDto with both fields required', () => {
    expect(
      schemas['UserUsageHistoryResponseDto'].properties?.['budget'],
    ).toMatchObject({
      allOf: [{ $ref: '#/components/schemas/UsageHistoryBudgetDto' }],
    });
    expect(schemas['UsageHistoryBudgetDto'].required).toEqual([
      'costObject',
      'policy',
    ]);
  });

  it('types the per-date model map as numbers keyed by deployment', () => {
    expect(
      schemas['UsageHistoryDailyEntryDto'].properties?.['byModel'],
    ).toMatchObject({
      type: 'object',
      additionalProperties: { type: 'number' },
    });
    expect(schemas['UsageHistoryDailyEntryDto'].required).toEqual(
      expect.arrayContaining(['date', 'spend', 'requests', 'byModel']),
    );
  });
});
