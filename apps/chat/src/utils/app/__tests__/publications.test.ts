import { describe, expect, it } from 'vitest';

import { transformIdToRootEntityId } from '@/src/utils/app/id';
import {
  buildDedupedPublicationFileTargetsFromConversations,
  createPublicationIconTargetUrl,
  getPublicItemIdForVersionCheck,
} from '@/src/utils/app/publications';
import { ApiUtils } from '@/src/utils/server/api';

import { Conversation } from '@epam/ai-dial-shared';

describe('createPublicationIconTargetUrl', () => {
  const targetFolder = 'public/Organization';

  it('puts the icon next to the published entity and names it after the entity', () => {
    expect(
      createPublicationIconTargetUrl({
        entityId: 'applications/mybucket/myapp__0.0.1',
        iconUrl: 'files/mybucket/folder1/icon.svg',
        targetFolder,
      }),
    ).toBe('files/public/Organization/myapp__0.0.1.svg');
  });

  it('keeps icons of two app versions apart when the file names match', () => {
    const first = createPublicationIconTargetUrl({
      entityId: 'applications/mybucket/myapp__0.0.1',
      iconUrl: 'files/mybucket/folder1/icon.svg',
      targetFolder,
    });
    const second = createPublicationIconTargetUrl({
      entityId: 'applications/mybucket/myapp__0.0.2',
      iconUrl: 'files/mybucket/folder2/icon.svg',
      targetFolder,
    });

    expect(first).not.toBe(second);
  });

  it('drops the source folder of the icon and creates no folder of its own', () => {
    expect(
      createPublicationIconTargetUrl({
        entityId: 'toolsets/mybucket/folder/mytoolset__1.0.0',
        iconUrl: 'files/mybucket/deeply/nested/folder/icon.svg',
        targetFolder,
      }),
    ).toBe('files/public/Organization/mytoolset__1.0.0.svg');
  });

  it('keeps the icon extension when the entity has no version', () => {
    expect(
      createPublicationIconTargetUrl({
        entityId: 'applications/mybucket/myapp',
        iconUrl: 'files/mybucket/folder1/icon.PNG',
        targetFolder,
      }),
    ).toBe('files/public/Organization/myapp.png');
  });

  it('publishes an icon without an extension under the entity name', () => {
    expect(
      createPublicationIconTargetUrl({
        entityId: 'applications/mybucket/myapp__0.0.1',
        iconUrl: 'files/mybucket/folder1/icon',
        targetFolder,
      }),
    ).toBe('files/public/Organization/myapp__0.0.1');
  });
});

describe('buildDedupedPublicationFileTargetsFromConversations', () => {
  const entityFolderId = 'conversations/mybucket/folder02';
  const sharedFile = 'files/mybucket/docs/shared.pdf';

  const convNested = {
    id: 'conversations/mybucket/folder02/nested/chat-1',
    messages: [
      {
        custom_content: {
          attachments: [{ url: sharedFile }],
        },
      },
    ],
  } as Conversation;

  const convRoot = {
    id: 'conversations/mybucket/folder02/chat-2',
    messages: [
      {
        custom_content: {
          attachments: [{ url: sharedFile }],
        },
      },
    ],
  } as Conversation;

  it('returns one target when the same file is attached under two chats in a folder publish', () => {
    const result = buildDedupedPublicationFileTargetsFromConversations(
      [convNested, convRoot],
      entityFolderId,
      true,
    );

    expect(result).toHaveLength(1);
    expect(result[0].oldUrl).toBe(ApiUtils.decodeApiUrl(sharedFile));

    const fromRoot = buildDedupedPublicationFileTargetsFromConversations(
      [convRoot],
      entityFolderId,
      true,
    );
    expect(result[0].newUrl).toBe(fromRoot[0].newUrl);
  });

  it('uses the shortest target path regardless of conversation order', () => {
    const forward = buildDedupedPublicationFileTargetsFromConversations(
      [convNested, convRoot],
      entityFolderId,
      true,
    );
    const reversed = buildDedupedPublicationFileTargetsFromConversations(
      [convRoot, convNested],
      entityFolderId,
      true,
    );

    expect(forward).toHaveLength(1);
    expect(reversed).toHaveLength(1);
    expect(reversed[0].newUrl).toBe(forward[0].newUrl);

    const fromRoot = buildDedupedPublicationFileTargetsFromConversations(
      [convRoot],
      entityFolderId,
      true,
    );
    expect(forward[0].newUrl).toBe(fromRoot[0].newUrl);
    expect(reversed[0].newUrl).toBe(fromRoot[0].newUrl);
  });

  it('uses transformIdToRootEntityId when not publishing a folder', () => {
    const decoded = ApiUtils.decodeApiUrl(sharedFile);
    const result = buildDedupedPublicationFileTargetsFromConversations(
      [convNested],
      entityFolderId,
      false,
    );

    expect(result).toHaveLength(1);
    expect(result[0].newUrl).toBe(transformIdToRootEntityId(decoded));
  });
});

describe('getPublicItemIdForVersionCheck', () => {
  const rootLevelId = 'conversations/mybucket/gpt__myChat';

  it('returns the id unchanged when not in publish model', () => {
    expect(
      getPublicItemIdForVersionCheck(rootLevelId, 'public/dept', false),
    ).toBe(rootLevelId);
  });

  it('rewrites the bucket segment to the root public target folder', () => {
    expect(getPublicItemIdForVersionCheck(rootLevelId, 'public', true)).toBe(
      'conversations/public/gpt__myChat',
    );
  });

  it('rewrites the bucket segment to a nested public target folder', () => {
    expect(
      getPublicItemIdForVersionCheck(rootLevelId, 'public/dept', true),
    ).toBe('conversations/public/dept/gpt__myChat');
  });

  it('returns the id unchanged when it has no path separator', () => {
    expect(getPublicItemIdForVersionCheck('single', 'public/dept', true)).toBe(
      'single',
    );
  });
});
