import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CatalogEntityParamsDto,
  CatalogEntityType,
} from '../dto/catalog-entity-params.dto';
import { UnpublishCatalogEntityDto } from '../dto/unpublish-catalog-entity.dto';

const validateBody = async (plain: Record<string, unknown>) => {
  const instance = plainToInstance(UnpublishCatalogEntityDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
};

const validateParams = async (plain: Record<string, unknown>) => {
  const instance = plainToInstance(CatalogEntityParamsDto, plain);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
};

describe('UnpublishCatalogEntityDto', () => {
  it('accepts a folderPath with an explicit version', async () => {
    await expect(
      validateBody({
        folderPath: 'Organization/Data Science',
        version: '1.2.0',
      }),
    ).resolves.toHaveLength(0);
  });

  /* Mirrors `PublishCatalogEntityDto`: unversioned Prompt and Skill resources have no version to send. */
  it('accepts an omitted version', async () => {
    await expect(
      validateBody({ folderPath: 'Organization/Data Science' }),
    ).resolves.toHaveLength(0);
  });

  it('accepts an empty folderPath, which targets the public root', async () => {
    await expect(validateBody({ folderPath: '' })).resolves.toHaveLength(0);
  });

  it('rejects a folderPath containing a path traversal segment', async () => {
    const errors = await validateBody({ folderPath: '../../etc/passwd' });
    expect(errors.some((error) => error.property === 'folderPath')).toBe(true);
  });

  it('rejects a non-string version', async () => {
    const errors = await validateBody({
      folderPath: 'Organization',
      version: 2,
    });
    expect(errors.some((error) => error.property === 'version')).toBe(true);
  });

  it('rejects a rules array, which unpublish must never forward', async () => {
    const errors = await validateBody({
      folderPath: 'Organization',
      rules: [],
    });
    expect(errors.some((error) => error.property === 'rules')).toBe(true);
  });
});

describe('CatalogEntityParamsDto on the unpublish route', () => {
  it('accepts every entity type the publish route accepts', async () => {
    for (const entityType of Object.values(CatalogEntityType)) {
      await expect(
        validateParams({ entityType, entityId: 'toolsets/bucket-123/tool' }),
      ).resolves.toHaveLength(0);
    }
  });

  it('rejects an unknown entityType', async () => {
    const errors = await validateParams({
      entityType: 'notAnEntity',
      entityId: 'toolsets/bucket-123/tool',
    });
    expect(errors.some((error) => error.property === 'entityType')).toBe(true);
  });
});
