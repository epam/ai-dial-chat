import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { IsCatalogResourcePath } from '../dto/catalog-resource-path.validator';
import { DiscardSharedCatalogItemDto } from '../dto/discard-shared-catalog-item.dto';
import { RevokeSharedAccessDto } from '../dto/revoke-shared-access.dto';
import { GetShareRecipientsDto } from '../dto/share-recipients.dto';

class CatalogResourcePathHolder {
  @IsCatalogResourcePath()
  itemId!: string;
}

const validateItemId = (itemId: string) =>
  validate(plainToInstance(CatalogResourcePathHolder, { itemId }));

describe('IsCatalogResourcePath', () => {
  it.each([
    [
      'accepts an applications/{bucket}/{path} itemId',
      { itemId: 'applications/owner-bucket/my-app' },
    ],
    [
      'accepts a toolsets/{bucket}/{path} itemId',
      { itemId: 'toolsets/owner-bucket/search__0.0.1' },
    ],
    [
      'accepts a conversations/{bucket}/{path} itemId',
      { itemId: 'conversations/owner-bucket/my-chat' },
    ],
    [
      'accepts a skills/{bucket}/{path} itemId',
      { itemId: 'skills/owner-bucket/team-a/docs-helper' },
    ],
    [
      'accepts a prompts/{bucket}/{path} itemId',
      { itemId: 'prompts/owner-bucket/Work/AI/summarize' },
    ],
    [
      'accepts a projects/{bucket}/{path} itemId',
      { itemId: 'projects/owner-bucket/marketing/q4-launch' },
    ],
    [
      'accepts a conversations itemId whose model id contains a colon',
      {
        itemId:
          'conversations/owner-bucket/anthropic.claude-haiku-4-5-20251001-v1:0__hi__ace3d220-6bf9-4774-afe7-9d641a3de401',
      },
    ],
    [
      'accepts a conversations itemId with dots inside a name',
      { itemId: 'conversations/owner-bucket/gpt-4o__Wait.. what__x' },
    ],
  ])('%s', async (_name, { itemId }) => {
    expect(await validateItemId(itemId)).toHaveLength(0);
  });

  it.each([
    [
      'rejects a skills itemId missing the item path segment',
      { itemId: 'skills/owner-bucket' },
    ],
    [
      'rejects a skills itemId with an empty bucket segment',
      { itemId: 'skills//team-a/docs-helper' },
    ],
    ['rejects an empty itemId', { itemId: '' }],
    [
      'rejects a bucket-relative prompt path with no prefix',
      { itemId: 'Work/AI/summarize' },
    ],
  ])('%s', async (_name, { itemId }) => {
    const errors = await validateItemId(itemId);

    expect(errors[0]?.constraints).toHaveProperty('isCatalogResourcePath');
  });
});

/*
 * The accept and reject rules above live in the validator. These rows prove
 * each share DTO still composes it with `IsDialResourceId` and the string
 * checks, so a decorator dropped from one DTO fails here.
 */
describe.each(
  [
    RevokeSharedAccessDto,
    GetShareRecipientsDto,
    DiscardSharedCatalogItemDto,
  ].map((dto) => [dto.name, dto] as const),
)('%s itemId', (_name, dto) => {
  const validateDto = (body: Record<string, unknown>) =>
    validate(plainToInstance(dto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  it.each([
    [
      'accepts an applications/{bucket}/{path} itemId',
      { itemId: 'applications/owner-bucket/my-app' },
    ],
    [
      'accepts a conversations itemId whose model id contains a colon',
      {
        itemId:
          'conversations/owner-bucket/anthropic.claude-haiku-4-5-20251001-v1:0__hi__ace3d220-6bf9-4774-afe7-9d641a3de401',
      },
    ],
    [
      'accepts a conversations itemId with dots inside a name',
      { itemId: 'conversations/owner-bucket/gpt-4o__Wait.. what__x' },
    ],
  ])('%s', async (_name, { itemId }) => {
    expect(await validateDto({ itemId })).toHaveLength(0);
  });

  it.each([
    [
      'rejects an itemId containing a path-traversal segment',
      { itemId: 'applications/owner-bucket/../escape' },
    ],
    ['rejects an empty itemId', { itemId: '' }],
    [
      'rejects a bucket-relative prompt path with no prefix',
      { itemId: 'Work/AI/summarize' },
    ],
  ])('%s', async (_name, { itemId }) => {
    const errors = await validateDto({ itemId });

    expect(errors.some((e) => e.property === 'itemId')).toBe(true);
  });

  it('rejects an itemId longer than 2048 characters', async () => {
    const errors = await validateDto({
      itemId: `applications/owner-bucket/${'a'.repeat(2048)}`,
    });

    expect(errors[0]?.constraints).toHaveProperty('maxLength');
  });

  it('rejects a conversations itemId with an encoded traversal segment', async () => {
    const errors = await validateDto({
      itemId: 'conversations/owner-bucket/%2e%2e/other-bucket/chat',
    });

    expect(errors).toHaveLength(1);
  });
});
