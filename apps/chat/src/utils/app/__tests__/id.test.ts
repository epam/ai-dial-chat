import { beforeAll, describe, expect, it, vi } from 'vitest';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import {
  areEntitiesBucketsTheSame,
  filterIdsByFeatureType,
  getApplicationRootId,
  getConversationRootId,
  getEntityBucket,
  getEntityNameFromId,
  getFileRootId,
  getIdWithoutFeatureType,
  getIdWithoutRootPathSegments,
  getPromptRootId,
  getRootId,
  getToolsetRootId,
  isApplicationId,
  isConversationId,
  isEntityIdExternal,
  isEntityIdLocal,
  isFileId,
  isFolderId,
  isMyApplication,
  isMyBucket,
  isMyEntity,
  isMyToolset,
  isPromptId,
  isRootConversationsId,
  isRootEntity,
  isRootId,
  isRootPromptId,
  isToolsetId,
  replaceIdWithBucket,
  transformIdToRootEntityId,
} from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { pathKeySeparator } from '@/src/utils/server/api';

import { ApiKeys, FeatureType } from '@/src/types/common';

import { DRAFT_APPLICATION_ID } from '@/src/constants/applications';
import { LOCAL_BUCKET } from '@/src/constants/chat';
import { DRAFT_TOOLSET_ID } from '@/src/constants/toolsets';

// ---- mocks ----
const splitEntityIdMock = vi.hoisted(() =>
  vi.fn((id: string) => {
    const parts = id.split('/').filter(Boolean);
    return {
      apiKey: parts[0],
      bucket: parts[1],
      name: parts.at(-1),
    };
  }),
);

vi.mock('@/src/utils/app/shared-utils', async (importOriginal) => {
  const actual = (await importOriginal()) as object;
  return {
    ...actual,
    splitEntityId: splitEntityIdMock,
  };
});

const myBucket = 'my-bucket';

beforeAll(() => {
  BucketService.setBucket(myBucket);
});

// ---- test-cases ----
describe('utils/app/id.ts', () => {
  describe('getRootId + root id helpers', () => {
    it('getRootId: prefers apiKey/bucket from splitEntityId(id) over passed bucket and BucketService bucket', () => {
      const id = `${ApiKeys.Conversations}/external-bucket/some/path/entity`;
      const result = getRootId({
        featureType: FeatureType.Chat,
        id,
        bucket: 'ignored-bucket',
      });

      expect(splitEntityIdMock).toHaveBeenCalledWith(id);

      const [apiKey, bucket] = result.split('/');
      expect(apiKey).toBe(ApiKeys.Conversations);
      expect(bucket).toBe('external-bucket');
      expect(isRootId(result)).toBe(true);
    });

    it('getRootId: uses EnumMapper api key by featureType when id is not provided', () => {
      const bucket = 'explicit-bucket';
      const result = getRootId({ featureType: FeatureType.Prompt, bucket });

      const expectedApiKey = EnumMapper.getApiKeyByFeatureType(
        FeatureType.Prompt,
      );
      const [apiKey, b] = result.split('/');
      expect(apiKey).toBe(expectedApiKey);
      expect(b).toBe(bucket);
      expect(isRootId(result)).toBe(true);
    });

    it('getRootId: uses BucketService.getBucket() when neither id.bucket nor bucket param is provided', () => {
      const result = getRootId({ featureType: FeatureType.File });

      const expectedApiKey = EnumMapper.getApiKeyByFeatureType(
        FeatureType.File,
      );
      const [apiKey, b] = result.split('/');
      expect(apiKey).toBe(expectedApiKey);
      expect(b).toBe(myBucket);
      expect(isRootId(result)).toBe(true);
    });

    it('getConversationRootId/getPromptRootId/getFileRootId wrappers call getRootId with correct featureType', () => {
      const convRoot = getConversationRootId();
      const promptRoot = getPromptRootId();
      const fileRoot = getFileRootId();

      expect(convRoot.split('/')[0]).toBe(
        EnumMapper.getApiKeyByFeatureType(FeatureType.Chat),
      );
      expect(promptRoot.split('/')[0]).toBe(
        EnumMapper.getApiKeyByFeatureType(FeatureType.Prompt),
      );
      expect(fileRoot.split('/')[0]).toBe(
        EnumMapper.getApiKeyByFeatureType(FeatureType.File),
      );

      expect(convRoot.split('/')[1]).toBe(myBucket);
      expect(promptRoot.split('/')[1]).toBe(myBucket);
      expect(fileRoot.split('/')[1]).toBe(myBucket);
    });

    it('getApplicationRootId/getToolsetRootId wrappers work', () => {
      const appRoot = getApplicationRootId();
      const toolsetRoot = getToolsetRootId();

      expect(appRoot.split('/')[0]).toBe(
        EnumMapper.getApiKeyByFeatureType(FeatureType.Application),
      );
      expect(toolsetRoot.split('/')[0]).toBe(
        EnumMapper.getApiKeyByFeatureType(FeatureType.Toolset),
      );

      expect(appRoot.split('/')[1]).toBe(myBucket);
      expect(toolsetRoot.split('/')[1]).toBe(myBucket);
    });
  });

  describe('root/id guards', () => {
    it('isRootId: true only when id has exactly 2 path segments', () => {
      expect(isRootId(`${ApiKeys.Conversations}/${myBucket}`)).toBe(true);
      expect(isRootId(`${ApiKeys.Conversations}/${myBucket}/x`)).toBe(false);
      expect(isRootId('just-one-seg')).toBe(false);
      expect(isRootId(undefined)).toBe(false);
    });

    it('isRootConversationsId / isRootPromptId', () => {
      expect(
        isRootConversationsId(`${ApiKeys.Conversations}/${myBucket}`),
      ).toBe(true);
      expect(isRootConversationsId(`${ApiKeys.Prompts}/${myBucket}`)).toBe(
        false,
      );

      expect(isRootPromptId(`${ApiKeys.Prompts}/${myBucket}`)).toBe(true);
      expect(isRootPromptId(`${ApiKeys.Conversations}/${myBucket}`)).toBe(
        false,
      );

      expect(isRootPromptId(undefined)).toBe(false);
      expect(isRootConversationsId(undefined)).toBe(false);
    });

    it('isRootEntity: true only when id has exactly 3 path segments', () => {
      expect(isRootEntity(`${ApiKeys.Conversations}/${myBucket}/entity`)).toBe(
        true,
      );
      expect(isRootEntity(`${ApiKeys.Conversations}/${myBucket}`)).toBe(false);
      expect(isRootEntity(`${ApiKeys.Conversations}/${myBucket}/a/b`)).toBe(
        false,
      );
    });
  });

  describe('type guards by ApiKeys prefix', () => {
    it('isFolderId', () => {
      expect(isFolderId('a/b/')).toBe(true);
      expect(isFolderId('a/b')).toBe(false);
    });

    it('isConversationId/isPromptId/isFileId/isApplicationId/isToolsetId', () => {
      expect(isConversationId(`${ApiKeys.Conversations}/${myBucket}/x`)).toBe(
        true,
      );
      expect(isConversationId(`${ApiKeys.Prompts}/${myBucket}/x`)).toBe(false);
      expect(isConversationId(undefined)).toBe(false);

      expect(isPromptId(`${ApiKeys.Prompts}/${myBucket}/x`)).toBe(true);
      expect(isPromptId(`${ApiKeys.Files}/${myBucket}/x`)).toBe(false);
      expect(isPromptId(undefined)).toBe(false);

      expect(isFileId(`${ApiKeys.Files}/${myBucket}/x`)).toBe(true);
      expect(isFileId(`${ApiKeys.Conversations}/${myBucket}/x`)).toBe(false);
      expect(isFileId(undefined)).toBe(false);

      expect(isApplicationId(`${ApiKeys.Applications}/${myBucket}/x`)).toBe(
        true,
      );
      expect(isApplicationId(`${ApiKeys.Toolsets}/${myBucket}/x`)).toBe(false);
      expect(isApplicationId(undefined)).toBe(false);

      expect(isToolsetId(`${ApiKeys.Toolsets}/${myBucket}/x`)).toBe(true);
      expect(isToolsetId(`${ApiKeys.Applications}/${myBucket}/x`)).toBe(false);
      expect(isToolsetId(undefined)).toBe(false);
    });
  });

  describe('id transformations', () => {
    it('getIdWithoutRootPathSegments: removes first 2 segments', () => {
      expect(getIdWithoutRootPathSegments('a/b/c/d')).toBe('c/d');
      expect(getIdWithoutRootPathSegments('a/b/c')).toBe('c');
      expect(getIdWithoutRootPathSegments('a/b')).toBe('');
    });

    it('getIdWithoutFeatureType: removes the first segment', () => {
      expect(getIdWithoutFeatureType('a/b/c')).toBe('b/c');
      expect(getIdWithoutFeatureType('a/b')).toBe('b');
      expect(getIdWithoutFeatureType('a')).toBe('');
    });

    it('replaceIdWithBucket: replaces second segment (bucket)', () => {
      expect(replaceIdWithBucket('a/old/c/d', 'new')).toBe('a/new/c/d');
    });

    it('transformIdToRootEntityId: converts any entity id to root-entity id (apiKey/bucket/name)', () => {
      const id = `${ApiKeys.Conversations}/${myBucket}/deep/path/to/entityName`;
      const out = transformIdToRootEntityId(id);

      const parts = out.split('/');
      expect(parts[0]).toBe(ApiKeys.Conversations);
      expect(parts[1]).toBe(myBucket);
      expect(parts[2]).toBe('entityName');
      expect(parts).toHaveLength(3);
    });
  });

  describe('bucket helpers', () => {
    it('getEntityBucket: returns second segment', () => {
      expect(getEntityBucket({ id: `a/${myBucket}/x` })).toBe(myBucket);
    });

    it('isEntityIdLocal / isEntityIdExternal', () => {
      const local = { id: `a/${LOCAL_BUCKET}/x` };
      const mine = { id: `a/${myBucket}/x` };
      const external = { id: `a/other-bucket/x` };

      expect(isEntityIdLocal(local)).toBe(true);
      expect(isEntityIdLocal(mine)).toBe(false);

      expect(isEntityIdExternal(local)).toBe(false);
      expect(isEntityIdExternal(mine)).toBe(false);
      expect(isEntityIdExternal(external)).toBe(true);
    });

    it('isMyBucket / isMyEntity', () => {
      expect(isMyBucket(LOCAL_BUCKET)).toBe(true);
      expect(isMyBucket(myBucket)).toBe(true);
      expect(isMyBucket('other-bucket')).toBe(false);

      expect(isMyEntity({ id: `a/${LOCAL_BUCKET}/x` })).toBe(true);
      expect(isMyEntity({ id: `a/${myBucket}/x` })).toBe(true);
      expect(isMyEntity({ id: `a/other-bucket/x` })).toBe(false);
    });

    it('areEntitiesBucketsTheSame', () => {
      expect(
        areEntitiesBucketsTheSame(
          `${ApiKeys.Conversations}/${myBucket}/a`,
          `${ApiKeys.Prompts}/${myBucket}/b`,
        ),
      ).toBe(true);

      expect(
        areEntitiesBucketsTheSame(
          `${ApiKeys.Conversations}/${myBucket}/a`,
          `${ApiKeys.Conversations}/other-bucket/a`,
        ),
      ).toBe(false);
    });
  });

  describe('draft + ownership helpers', () => {
    it('isMyApplication: true for DRAFT_APPLICATION_ID or for entities in my bucket/local bucket', () => {
      expect(isMyApplication({ id: DRAFT_APPLICATION_ID })).toBe(true);

      expect(
        isMyApplication({ id: `${ApiKeys.Applications}/${myBucket}/x` }),
      ).toBe(true);
      expect(
        isMyApplication({ id: `${ApiKeys.Applications}/${LOCAL_BUCKET}/x` }),
      ).toBe(true);

      expect(
        isMyApplication({ id: `${ApiKeys.Applications}/other-bucket/x` }),
      ).toBe(false);
    });

    it('isMyToolset: true for DRAFT_TOOLSET_ID or for entities in my bucket/local bucket', () => {
      expect(isMyToolset({ id: DRAFT_TOOLSET_ID })).toBe(true);

      expect(isMyToolset({ id: `${ApiKeys.Toolsets}/${myBucket}/x` })).toBe(
        true,
      );
      expect(isMyToolset({ id: `${ApiKeys.Toolsets}/${LOCAL_BUCKET}/x` })).toBe(
        true,
      );

      expect(isMyToolset({ id: `${ApiKeys.Toolsets}/other-bucket/x` })).toBe(
        false,
      );
    });
  });

  describe('filterIdsByFeatureType', () => {
    const ids = [
      `${ApiKeys.Conversations}/${myBucket}/c1`,
      `${ApiKeys.Conversations}/${myBucket}/c2`,
      `${ApiKeys.Prompts}/${myBucket}/p1`,
      `${ApiKeys.Files}/${myBucket}/f1`,
      `${ApiKeys.Applications}/${myBucket}/a1`,
      `${ApiKeys.Toolsets}/${myBucket}/t1`,
      `unknown/${myBucket}/u1`,
    ];

    it('filters Chat ids', () => {
      expect(filterIdsByFeatureType(ids, FeatureType.Chat)).toEqual([
        `${ApiKeys.Conversations}/${myBucket}/c1`,
        `${ApiKeys.Conversations}/${myBucket}/c2`,
      ]);
    });

    it('filters Prompt ids', () => {
      expect(filterIdsByFeatureType(ids, FeatureType.Prompt)).toEqual([
        `${ApiKeys.Prompts}/${myBucket}/p1`,
      ]);
    });

    it('filters Application ids', () => {
      expect(filterIdsByFeatureType(ids, FeatureType.Application)).toEqual([
        `${ApiKeys.Applications}/${myBucket}/a1`,
      ]);
    });

    it('filters File ids', () => {
      expect(filterIdsByFeatureType(ids, FeatureType.File)).toEqual([
        `${ApiKeys.Files}/${myBucket}/f1`,
      ]);
    });

    it('filters Toolset ids', () => {
      expect(filterIdsByFeatureType(ids, FeatureType.Toolset)).toEqual([
        `${ApiKeys.Toolsets}/${myBucket}/t1`,
      ]);
    });

    it('returns [] for unknown/unsupported featureType', () => {
      expect(
        filterIdsByFeatureType(ids, 'Unknown' as unknown as FeatureType),
      ).toEqual([]);
    });
  });

  describe('getEntityNameFromId', () => {
    it('returns last path segment by default', () => {
      expect(getEntityNameFromId('a/b/c')).toBe('c');
      expect(getEntityNameFromId('a/b/c/d')).toBe('d');
    });

    it('removeVersion: strips suffix after pathKeySeparator', () => {
      const id = `a/b/name${pathKeySeparator}v12`;
      expect(getEntityNameFromId(id, { removeVersion: true })).toBe('name');
      expect(getEntityNameFromId(id, { removeVersion: false })).toBe(
        `name${pathKeySeparator}v12`,
      );
    });

    it('removeVersion: if separator is missing, returns the full name', () => {
      const id = 'a/b/nameWithoutVersion';
      expect(getEntityNameFromId(id, { removeVersion: true })).toBe(
        'nameWithoutVersion',
      );
    });
  });
});
