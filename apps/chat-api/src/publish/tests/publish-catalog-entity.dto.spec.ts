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

describe('PublishCatalogEntityDto — version', () => {
  it('accepts an omitted version for unversioned resources', async () => {
    const errors = await validateDto({
      folderPath: 'Organization/Data Science',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string version', async () => {
    const errors = await validateDto({ ...BASE_BODY, version: 2 });
    expect(errors.some((error) => error.property === 'version')).toBe(true);
  });
});

describe('PublishCatalogEntityDto — author', () => {
  it('passes when author is omitted', async () => {
    const errors = await validateDto(BASE_BODY);
    expect(errors).toHaveLength(0);
  });

  it('accepts a plain display author', async () => {
    const errors = await validateDto({ ...BASE_BODY, author: 'DIAL Team' });
    expect(errors).toHaveLength(0);
  });

  it('accepts an author at the 200-character limit', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      author: 'a'.repeat(200),
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts an author containing regex metacharacters and non-Latin script', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      author: 'p{Cc} — Команда DIAL (فريق)',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an author longer than 200 characters', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      author: 'a'.repeat(201),
    });
    expect(errors.some((error) => error.property === 'author')).toBe(true);
  });

  it('rejects a non-string author', async () => {
    const errors = await validateDto({ ...BASE_BODY, author: 42 });
    expect(errors.some((error) => error.property === 'author')).toBe(true);
  });

  it('rejects an author containing a newline', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      author: 'DIAL Team\nInjected log line',
    });
    expect(errors.some((error) => error.property === 'author')).toBe(true);
  });

  it('rejects an author containing a NUL byte', async () => {
    const errors = await validateDto({
      ...BASE_BODY,
      author: 'DIAL\u0000Team',
    });
    expect(errors.some((error) => error.property === 'author')).toBe(true);
  });
});

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

  it('accepts entityType: prompt with a full prompts/{bucket}/{path} entityId', async () => {
    const errors = await validateParams({
      entityType: CatalogEntityType.Prompt,
      entityId: 'prompts/bucket-123/Work/AI/summarize',
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
