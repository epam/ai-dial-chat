import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { DiscardSharedCatalogItemDto } from '../dto/discard-shared-catalog-item.dto';

/*
 * The itemId rules this DTO shares with the revoke and recipients DTOs are in
 * catalog-resource-path.validator.spec.ts. This file keeps the rules only
 * Discard has.
 */
const validateDto = (body: Record<string, unknown>) => {
  const instance = plainToInstance(DiscardSharedCatalogItemDto, body);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
};

describe('DiscardSharedCatalogItemDto', () => {
  it('accepts a whole skills/{bucket}/{path} itemId', async () => {
    const errors = await validateDto({
      itemId: 'skills/owner-bucket/team-a/docs-helper',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a skills/ itemId that identifies an individual file inside the skill', async () => {
    const errors = await validateDto({
      itemId: 'skills/owner-bucket/team-a/docs-helper/files/notes.md',
    });
    expect(errors.some((e) => e.property === 'itemId')).toBe(true);
  });

  it('rejects an unknown top-level field like the removed resourceKind', async () => {
    const errors = await validateDto({
      itemId: 'prompts/owner-bucket/Work/AI/summarize',
      resourceKind: 'prompt',
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
