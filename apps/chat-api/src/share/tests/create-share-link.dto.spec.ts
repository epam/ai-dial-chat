import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateShareLinkDto, ShareAccess } from '../dto/create-share-link.dto';

const validateDto = (body: Record<string, unknown>) => {
  const instance = plainToInstance(CreateShareLinkDto, {
    access: [ShareAccess.View],
    ...body,
  });
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
};

describe('CreateShareLinkDto', () => {
  it.each([
    'gpt-4o',
    'applications/owner-bucket/my-app',
    'conversations/owner-bucket/my-chat',
    'conversations/owner-bucket/anthropic.claude-haiku-4-5-20251001-v1:0__hi__ace3d220-6bf9-4774-afe7-9d641a3de401',
    'conversations/owner-bucket/applications/catalog/Team%2FApp%20One__0.0.1__hello',
    'prompts/owner-bucket/My folder/My prompt, v2',
  ])('accepts the itemId %s', async (itemId) => {
    const errors = await validateDto({ itemId });
    expect(errors).toHaveLength(0);
  });

  it.each([
    '',
    '/applications/owner-bucket/my-app',
    'applications/owner-bucket/../other-bucket/app',
    'applications/owner-bucket/%2e%2e/other-bucket/app',
    'conversations/owner-bucket/a{b',
    'conversations/owner-bucket/a?b',
  ])('rejects the itemId %j', async (itemId) => {
    const errors = await validateDto({ itemId });
    expect(errors).toHaveLength(1);
  });

  it('rejects an empty access list', async () => {
    const errors = await validateDto({ itemId: 'gpt-4o', access: [] });
    expect(errors).toHaveLength(1);
  });
});
