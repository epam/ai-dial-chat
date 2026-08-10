import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { DiscardSharedCatalogItemDto } from '../dto/discard-shared-catalog-item.dto';

const validateDto = (itemId: string) => {
  const instance = plainToInstance(DiscardSharedCatalogItemDto, { itemId });
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
};

describe('DiscardSharedCatalogItemDto', () => {
  it('accepts an applications/{bucket}/{path} itemId', async () => {
    const errors = await validateDto('applications/owner-bucket/my-app');
    expect(errors).toHaveLength(0);
  });

  it('accepts a toolsets/{bucket}/{path} itemId', async () => {
    const errors = await validateDto('toolsets/owner-bucket/search__0.0.1');
    expect(errors).toHaveLength(0);
  });

  it('accepts a conversations/{bucket}/{path} itemId', async () => {
    const errors = await validateDto('conversations/owner-bucket/my-chat');
    expect(errors).toHaveLength(0);
  });

  it('accepts a whole skills/{bucket}/{path} itemId', async () => {
    const errors = await validateDto('skills/owner-bucket/team-a/docs-helper');
    expect(errors).toHaveLength(0);
  });

  it('rejects a skills/ itemId that identifies an individual file inside the skill', async () => {
    const errors = await validateDto(
      'skills/owner-bucket/team-a/docs-helper/files/notes.md',
    );
    expect(errors.some((e) => e.property === 'itemId')).toBe(true);
  });

  it('rejects an unsupported resource prefix', async () => {
    const errors = await validateDto('prompts/owner-bucket/my-prompt');
    expect(errors.some((e) => e.property === 'itemId')).toBe(true);
  });

  it('rejects an itemId containing a path-traversal segment', async () => {
    const errors = await validateDto('applications/owner-bucket/../escape');
    expect(errors.some((e) => e.property === 'itemId')).toBe(true);
  });

  it('rejects an empty itemId', async () => {
    const errors = await validateDto('');
    expect(errors.some((e) => e.property === 'itemId')).toBe(true);
  });
});
