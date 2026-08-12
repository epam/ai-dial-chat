import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CatalogEntityParamsDto,
  CatalogEntityType,
} from '../dto/catalog-entity-params.dto';
import { PublishCatalogEntityDto } from '../dto/publish-catalog-entity.dto';

const BASE_BODY = {
  folderPath: 'Organization/Data Science',
  version: '1.2.0',
};

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(PublishCatalogEntityDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('PublishCatalogEntityDto — rules', () => {
  it('passes when rules is omitted', async () => {
    const errors = await validateDto(BASE_BODY);
    expect(errors).toHaveLength(0);
  });

  it('passes when rules is an empty array', async () => {
    const errors = await validateDto({ ...BASE_BODY, rules: [] });
    expect(errors).toHaveLength(0);
  });

  it('passes with a valid nested rule', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      rules: [
        { source: 'roles', function: 'CONTAIN', targets: ['engineering'] },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects more than 20 rules', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      rules: Array.from({ length: 21 }, () => ({
        source: 'roles',
        function: 'CONTAIN',
        targets: ['engineering'],
      })),
    });
    expect(errors.some((e) => e.property === 'rules')).toBe(true);
  });

  it('rejects a malformed nested rule object', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      rules: [{ source: 123, function: 'CONTAIN', targets: 'engineering' }],
    });
    expect(errors.some((e) => e.property === 'rules')).toBe(true);
  });

  it('rejects a rule with an invalid function enum value', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      rules: [
        { source: 'roles', function: 'MATCHES', targets: ['engineering'] },
      ],
    });
    expect(errors.some((e) => e.property === 'rules')).toBe(true);
  });
});

describe('CatalogEntityParamsDto — entityType', () => {
  const validateParams = async (plain: Record<string, unknown>) => {
    const instance = plainToInstance(CatalogEntityParamsDto, plain);
    return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  };

  it('accepts entityType: skill with a nested skill entityId', async () => {
    const errors = await validateParams({
      entityType: CatalogEntityType.Skill,
      entityId: 'skills/bucket-123/team-a/docs-helper',
    });
    expect(errors).toHaveLength(0);
  });

  /*
   * A prompt's entityId is bucket-relative, unlike every other kind: the
   * prompts endpoints never expose a bucket, so `publish.service.ts` re-attaches
   * the caller's own before calling DIAL Core.
   */
  it('accepts entityType: prompt with a bucket-relative prompt entityId', async () => {
    const errors = await validateParams({
      entityType: CatalogEntityType.Prompt,
      entityId: 'Work/AI/summarize',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown entityType', async () => {
    const errors = await validateParams({
      entityType: 'conversation',
      entityId: 'conversations/bucket-123/my-chat',
    });
    expect(errors.some((e) => e.property === 'entityType')).toBe(true);
  });
});
