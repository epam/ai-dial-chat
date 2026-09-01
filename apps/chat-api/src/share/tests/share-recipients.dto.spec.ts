import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { GetShareRecipientsDto } from '../dto/share-recipients.dto';

const validateDto = (body: Record<string, unknown>) => {
  const instance = plainToInstance(GetShareRecipientsDto, body);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
};

describe('GetShareRecipientsDto', () => {
  it('accepts an applications/{bucket}/{path} itemId', async () => {
    const errors = await validateDto({
      itemId: 'applications/owner-bucket/my-app',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a toolsets/{bucket}/{path} itemId', async () => {
    const errors = await validateDto({
      itemId: 'toolsets/owner-bucket/search__0.0.1',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a conversations/{bucket}/{path} itemId', async () => {
    const errors = await validateDto({
      itemId: 'conversations/owner-bucket/my-chat',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a skills/{bucket}/{path} itemId', async () => {
    const errors = await validateDto({
      itemId: 'skills/owner-bucket/team-a/docs-helper',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a skills itemId missing the item path segment', async () => {
    const errors = await validateDto({ itemId: 'skills/owner-bucket' });
    expect(errors.some((e) => e.property === 'itemId')).toBe(true);
  });

  it('rejects a skills itemId with an empty bucket segment', async () => {
    const errors = await validateDto({
      itemId: 'skills//team-a/docs-helper',
    });
    expect(errors.some((e) => e.property === 'itemId')).toBe(true);
  });

  it('accepts a prompts/{bucket}/{path} itemId', async () => {
    const errors = await validateDto({
      itemId: 'prompts/owner-bucket/Work/AI/summarize',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an itemId containing a path-traversal segment', async () => {
    const errors = await validateDto({
      itemId: 'applications/owner-bucket/../escape',
    });
    expect(errors.some((e) => e.property === 'itemId')).toBe(true);
  });

  it('rejects an empty itemId', async () => {
    const errors = await validateDto({ itemId: '' });
    expect(errors.some((e) => e.property === 'itemId')).toBe(true);
  });

  it('rejects a bucket-relative prompt path with no prefix', async () => {
    const errors = await validateDto({ itemId: 'Work/AI/summarize' });
    expect(errors.some((e) => e.property === 'itemId')).toBe(true);
  });
});
