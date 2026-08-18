import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RevokeSharedAccessDto } from '../dto/revoke-shared-access.dto';

const validateDto = (itemId: string) => {
  const instance = plainToInstance(RevokeSharedAccessDto, { itemId });
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
};

describe('RevokeSharedAccessDto', () => {
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

  it('accepts a skills/{bucket}/{path} itemId', async () => {
    const errors = await validateDto('skills/owner-bucket/team-a/docs-helper');
    expect(errors).toHaveLength(0);
  });

  it('rejects a skills itemId missing the item path segment', async () => {
    const errors = await validateDto('skills/owner-bucket');
    expect(errors.some((e) => e.property === 'itemId')).toBe(true);
  });

  it('rejects a skills itemId with an empty bucket segment', async () => {
    const errors = await validateDto('skills//team-a/docs-helper');
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
