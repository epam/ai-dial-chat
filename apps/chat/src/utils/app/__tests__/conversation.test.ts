import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addPausedError,
  excludeSystemMessages,
  fitConversationNameToStorageLimits,
  getAvailableConversationNameBytes,
  getConversationInfoFromId,
  getConversationModelParams,
  getDefaultModelReference,
  getExistingConversationNamesForNaming,
  getGeneratedConversationId,
  getMessageCustomContent,
  getNewConversationName,
  getOpenAIEntityFullName,
  getQuickAttachmentsSavingPath,
  getStorageSafeUniqueConversationName,
  getSystemMessageContent,
  isChosenConversationValidForCompare,
  isConversationInfoEntity,
  isLoadedConversationEntity,
  isOldConversationReplay,
  isPlaybackConversation,
  isReplayAsIsConversation,
  isReplayConversation,
  isSettingsChanged,
  isSystemMessage,
  isValidConversationForCompare,
  regenerateConversationId,
  sortByDateAndName,
  updateAttachmentUrlOnMove,
  updateMessagesAttachmentsOnMove,
  updateMessagesAttachmentsTitles,
} from '@/src/utils/app/conversation';

import { ApiKeys } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';

import {
  Conversation,
  ConversationInfo,
  Message,
  MessageFormSchema,
  Role,
  ShareEntity,
  UploadStatus,
} from '@epam/ai-dial-shared';
import omit from 'lodash-es/omit';

// ---- mocks ----
const mockFns = vi.hoisted(() => {
  return {
    prepareEntityName: vi.fn(),
    getConfigurationValue: vi.fn(),
    getConfigurationSchema: vi.fn(),
    getChosenFormButtons: vi.fn(),
    constructPath: vi.fn(),
    getConversationApiKey: vi.fn(),
    getConversationRootId: vi.fn(),
    getEntityBucket: vi.fn(),
    splitEntityId: vi.fn(),
    parseEntityApiKey: vi.fn(),
    isEntityIdLocal: vi.fn(),
    isEntityNameOrPathInvalid: vi.fn(),
    isConversationWithFormSchema: vi.fn(),
    getFileRootId: vi.fn(),
    getLastPathSegment: vi.fn((s: string) => s.split('/').pop()),
    isAttachmentLink: vi.fn((url: string) => /^https?:\/\//.test(url)),
    ApiUtils: {
      decodeApiUrl: vi.fn((s: string) => s),
      encodeApiUrl: vi.fn((s: string) => s),
    },
  };
});

vi.mock('@/src/utils/app/common', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/src/utils/app/common')>();
  return {
    ...actual,
    prepareEntityName: mockFns.prepareEntityName,
    isEntityNameOrPathInvalid: mockFns.isEntityNameOrPathInvalid,
    getLastPathSegment: mockFns.getLastPathSegment,
  };
});
vi.mock('@/src/utils/app/form-schema', () => ({
  getConfigurationValue: mockFns.getConfigurationValue,
  getConfigurationSchema: mockFns.getConfigurationSchema,
  getChosenFormButtons: mockFns.getChosenFormButtons,
  isConversationWithFormSchema: mockFns.isConversationWithFormSchema,
}));
vi.mock('@/src/utils/app/id', () => ({
  getConversationRootId: mockFns.getConversationRootId,
  getEntityBucket: mockFns.getEntityBucket,
  isEntityIdLocal: mockFns.isEntityIdLocal,
  getFileRootId: mockFns.getFileRootId,
}));
vi.mock('@/src/utils/app/file', () => ({
  constructPath: mockFns.constructPath,
  notAllowedSymbolsRegex: /[<>]/g,
  isAttachmentLink: mockFns.isAttachmentLink,
}));
vi.mock('@/src/utils/server/api', () => ({
  getConversationApiKey: mockFns.getConversationApiKey,
  parseEntityApiKey: mockFns.parseEntityApiKey,
  ApiUtils: mockFns.ApiUtils,
}));
vi.mock('@/src/utils/app/shared-utils', () => ({
  splitEntityId: mockFns.splitEntityId,
}));

// ---- fixtures ----
const bucket = 'my-bucket';

const testMessage1 = {
  content: 'test1',
  role: Role.User,
};
const testMessage2 = {
  content: 'test2',
  role: Role.Assistant,
};
const testMessage3 = {
  content: '',
  role: Role.User,
  custom_content: {
    attachments: [
      {
        type: 'text/plain',
        title: 'test3',
        reference_url: 'test-ref-1',
        url: `${ApiKeys.Files}/${bucket}/testUrl3`,
      },
    ],
  },
};
const testMessage4 = {
  content: '',
  role: Role.User,
  custom_content: {
    attachments: [
      {
        type: 'text/plain',
        title: '',
        reference_url: 'test-ref-1',
        url: `${ApiKeys.Files}/${bucket}/testUrl4`,
      },
    ],
  },
};

const testMessage5 = {
  content: 'test5',
  role: Role.System,
};

const testConv1: Conversation = {
  id: `${ApiKeys.Conversations}/${bucket}/model__test1__1.0.0`,
  folderId: `${ApiKeys.Conversations}/${bucket}`,
  name: 'test1',
  messages: [],
  temperature: 0.1,
  prompt: '',
  model: { id: 'model' },
  selectedAddons: ['test_addon', 'test_addon2'],
  createdAt: 1766865201704,
  updatedAt: 1766865201704,
};
const testConv2: Conversation = {
  id: `${ApiKeys.Conversations}/public/model__test2__1.0.0`,
  folderId: `${ApiKeys.Conversations}/public`,
  name: 'test2',
  messages: [],
  temperature: 0.1,
  prompt: '',
  model: { id: 'model' },
  selectedAddons: ['test_addon', 'test_addon2'],
  createdAt: 1766865224775,
  updatedAt: 1766865224775,
};

// ---- test-cases ----
describe('utils/app/conversation.ts', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe('isSettingsChanged', () => {
    it('Should return false if settings are same', () => {
      expect(
        isSettingsChanged(testConv1, { prompt: '', temperature: 0.1 }),
      ).toBe(false);
      expect(
        isSettingsChanged(testConv1, {
          prompt: '',
          temperature: 0.1,
          selectedAddons: ['test_addon2', 'test_addon'],
        }),
      ).toBe(false);
    });

    it('Should return true if settings were not changed', () => {
      expect(
        isSettingsChanged(testConv1, { prompt: 'test', temperature: 0.1 }),
      ).toBe(true);
      expect(
        isSettingsChanged(testConv1, {
          prompt: '',
          temperature: 0.1,
          selectedAddons: ['test_addon3'],
        }),
      ).toBe(true);
    });
  });

  describe('getNewConversationName', () => {
    beforeEach(() => {
      mockFns.prepareEntityName.mockImplementation((n: string) => n);
    });

    it('Should return name from message content if provided', () => {
      expect(getNewConversationName(testConv1, testMessage1)).toBe(
        testMessage1.content,
      );
      expect(getNewConversationName(testConv1, testMessage2)).toBe(
        testMessage2.content,
      );
    });
    it('Should return title from message attachment if no content provided', () => {
      expect(getNewConversationName(testConv1, testMessage3)).toBe(
        testMessage3.custom_content.attachments[0].title,
      );
    });
    it('Should return reference_url from message attachment if no content and title are provided', () => {
      expect(getNewConversationName(testConv1, testMessage4)).toBe(
        testMessage4.custom_content.attachments[0].reference_url,
      );
    });
    it('Should return title from schema definitions if no content, attachment title or reference_url are provided', () => {
      mockFns.getConfigurationSchema.mockReturnValue({});
      mockFns.getConfigurationValue.mockReturnValue({});
      mockFns.getChosenFormButtons.mockReturnValue([
        { title: 'test-value-from-schema' },
      ]);

      expect(
        getNewConversationName(testConv1, { content: '', role: Role.User }),
      ).toBe('test-value-from-schema');
      expect(mockFns.getConfigurationValue).toHaveBeenCalled();
      expect(mockFns.getConfigurationValue).toHaveBeenCalled();
      expect(mockFns.getChosenFormButtons).toHaveBeenCalled();
    });
    it('Should return conversation name if message is empty', () => {
      expect(
        getNewConversationName(testConv1, { content: '', role: Role.User }),
      ).toBe(testConv1.name);
    });
  });

  describe('conversation storage name limits', () => {
    beforeEach(() => {
      mockFns.prepareEntityName.mockImplementation((n: string) => n);
      mockFns.constructPath.mockImplementation((...args: string[]) =>
        args.filter(Boolean).join('/'),
      );
      mockFns.getConversationApiKey.mockImplementation(
        (c: ConversationInfo) => c.name,
      );
    });

    it('Should calculate available name bytes including the path separator before the name', () => {
      const folderRoot = `${ApiKeys.Conversations}/${bucket}/`;
      const targetAvailableBytes = 5;
      const folderTailLength =
        1024 - folderRoot.length - 1 - targetAvailableBytes;
      const folderId = `${folderRoot}${'a'.repeat(folderTailLength)}`;

      expect(
        getAvailableConversationNameBytes(
          {
            ...testConv1,
            folderId,
            name: 'abcdefghij',
          },
          { maxIdBytes: 1024 },
        ),
      ).toBe(targetAvailableBytes);
    });

    it('Should trim ASCII conversation names to the available storage budget', () => {
      const folderRoot = `${ApiKeys.Conversations}/${bucket}/`;
      const targetAvailableBytes = 5;
      const folderTailLength =
        1024 - folderRoot.length - 1 - targetAvailableBytes;
      const folderId = `${folderRoot}${'a'.repeat(folderTailLength)}`;

      expect(
        fitConversationNameToStorageLimits(
          {
            ...testConv1,
            folderId,
            name: 'abcdefghij',
          },
          { maxIdBytes: 1024 },
        ).name,
      ).toBe('abcde');
    });

    it('Should trim UTF-8 conversation names by bytes, not by character count', () => {
      const folderRoot = `${ApiKeys.Conversations}/${bucket}/`;
      const targetAvailableBytes = 4;
      const folderTailLength =
        1024 - folderRoot.length - 1 - targetAvailableBytes;
      const folderId = `${folderRoot}${'a'.repeat(folderTailLength)}`;

      expect(
        fitConversationNameToStorageLimits(
          {
            ...testConv1,
            folderId,
            name: 'яяя',
          },
          { maxIdBytes: 1024 },
        ).name,
      ).toBe('яя');
    });

    it('Should trim conversation name by api key segment byte limit when configured', () => {
      mockFns.getConversationApiKey.mockImplementation(
        (c: ConversationInfo) => `${c.model.id}__${c.name}`,
      );

      expect(
        fitConversationNameToStorageLimits(
          {
            ...testConv1,
            model: { id: 'model' },
            name: 'abcdef',
          },
          { maxSegmentBytes: 10 },
        ).name,
      ).toBe('abc');
    });

    it('Should keep conversation name unchanged when storage byte limits are not configured', () => {
      expect(
        fitConversationNameToStorageLimits(
          {
            ...testConv1,
            name: 'a'.repeat(160),
          },
          {},
        ).name,
      ).toBe('a'.repeat(160));
      expect(getAvailableConversationNameBytes(testConv1, {})).toBeUndefined();
    });

    it('Should preserve numbering uniqueness under segment byte limits', () => {
      mockFns.getConversationApiKey.mockImplementation(
        (c: ConversationInfo) => `${c.model.id}__${c.name}`,
      );

      expect(
        getStorageSafeUniqueConversationName({
          conversation: {
            ...testConv1,
            model: { id: 'model' },
          },
          desiredName: 'abc',
          existingNames: ['abc'],
          limits: { maxSegmentBytes: 10 },
        }),
      ).toBe('a 1');
    });

    it('Should apply classic numbering when limits are not configured', () => {
      expect(
        getStorageSafeUniqueConversationName({
          conversation: testConv1,
          desiredName: 'conversation',
          existingNames: ['conversation', 'conversation 1'],
        }),
      ).toBe('conversation 2');
    });
  });

  describe('getExistingConversationNamesForNaming', () => {
    const rootFolderId = `${ApiKeys.Conversations}/local`;
    const subFolderId = `${rootFolderId}/nested`;

    const conversations: Conversation[] = [
      {
        ...testConv1,
        id: `${subFolderId}/a`,
        folderId: subFolderId,
        name: 'sub-chat',
      },
      {
        ...testConv1,
        id: `${rootFolderId}/b`,
        folderId: rootFolderId,
        name: 'root-chat',
      },
      {
        ...testConv1,
        id: `${rootFolderId}/target`,
        folderId: subFolderId,
        name: 'target',
      },
    ];

    it('Should collect names from the same folder and root folder', () => {
      expect(
        getExistingConversationNamesForNaming(
          conversations,
          { id: `${rootFolderId}/target`, folderId: subFolderId },
          {
            isOverlay: false,
            conversationRootFolderId: rootFolderId,
          },
        ),
      ).toEqual(['sub-chat', 'root-chat']);
    });

    it('Should use overlay folder instead of root when overlay is configured', () => {
      const overlayFolderId = `${rootFolderId}/overlay`;
      const overlayConversations: Conversation[] = [
        ...conversations,
        {
          ...testConv1,
          id: `${overlayFolderId}/overlay-chat`,
          folderId: overlayFolderId,
          name: 'overlay-chat',
        },
      ];

      expect(
        getExistingConversationNamesForNaming(
          overlayConversations,
          { id: `${rootFolderId}/target`, folderId: subFolderId },
          {
            isOverlay: true,
            overlayNewConversationsFolder: overlayFolderId,
            conversationRootFolderId: rootFolderId,
          },
        ),
      ).toEqual(['sub-chat', 'overlay-chat']);
    });
  });

  describe('getGeneratedConversationId', () => {
    beforeEach(() => {
      mockFns.constructPath.mockImplementation((...args: string[]) =>
        args.join('/'),
      );
      mockFns.getConversationApiKey.mockImplementation(
        (c: ConversationInfo) => c.name,
      );
      mockFns.getConversationRootId.mockImplementation(
        (b?: string) => `${ApiKeys.Conversations}/${b ?? bucket}`,
      );
    });

    it('Should generate id with folderId if provided', () => {
      expect(getGeneratedConversationId(testConv1)).toBe(
        `${testConv1.folderId}/${testConv1.name}`,
      );
    });
    it('Should generate id if folderId is empty but id is provided', () => {
      mockFns.getEntityBucket.mockReturnValue('public');
      expect(
        getGeneratedConversationId(
          omit(testConv2, ['folderId']) as Conversation,
        ),
      ).toBe(`${ApiKeys.Conversations}/public/${testConv2.name}`);
    });
    it('Should generate id using local bucket if id and folderId are not provided', () => {
      expect(
        getGeneratedConversationId(
          omit(testConv1, ['id', 'folderId']) as Conversation,
        ),
      ).toBe(`${ApiKeys.Conversations}/${bucket}/${testConv1.name}`);
    });
  });

  describe('regenerateConversationId', () => {
    beforeEach(() => {
      mockFns.constructPath.mockImplementation((...args: string[]) =>
        args.join('/'),
      );
      mockFns.getConversationApiKey.mockImplementation(
        (c: ConversationInfo) => c.name,
      );
      mockFns.getConversationRootId.mockImplementation(
        (b?: string) => `${ApiKeys.Conversations}/${b ?? bucket}`,
      );
    });
    const expectedId = `${ApiKeys.Conversations}/${bucket}/${testConv1.name}`;

    it('Should replace id with new one if generated different id', () => {
      expect(regenerateConversationId(testConv1).id).toBe(expectedId);
    });
    it('Should set new generated id if none exists', () => {
      expect(regenerateConversationId(omit(testConv1, ['id'])).id).toBe(
        expectedId,
      );
    });
    it('Should leave old id if new one is same', () => {
      expect(
        regenerateConversationId({ ...testConv1, id: expectedId }).id,
      ).toBe(expectedId);
    });
  });

  describe('getConversationInfoFromId', () => {
    beforeEach(() => {
      mockFns.constructPath.mockImplementation((...args: string[]) =>
        args.filter(Boolean).join('/'),
      );
      mockFns.getConversationApiKey.mockImplementation(
        (c: ConversationInfo) => c.name,
      );
      mockFns.getConversationRootId.mockImplementation(
        (b?: string) => `${ApiKeys.Conversations}/${b ?? bucket}`,
      );
      mockFns.splitEntityId.mockReturnValue({
        apiKey: ApiKeys.Conversations,
        bucket,
        name: testConv1.name,
        parentPath: '',
      });
    });

    it('Should return valid conversation info with version', () => {
      mockFns.splitEntityId.mockReturnValueOnce({
        apiKey: ApiKeys.Conversations,
        bucket,
        name: testConv1.name,
        parentPath: '',
      });
      mockFns.parseEntityApiKey.mockReturnValueOnce({
        modelInfo: { model: testConv1.model },
        version: '1.0.0',
        name: testConv1.name,
      });
      const expected = {
        name: testConv1.name,
        folderId: testConv1.folderId,
        model: testConv1.model,
        id: 'conversations/my-bucket/test1',
        publicationInfo: {
          version: '1.0.0',
        },
      };

      expect(
        getConversationInfoFromId(testConv1.id, { parseVersion: true }),
      ).toEqual(expected);
    });

    it('Should return valid conversation info without version', () => {
      mockFns.parseEntityApiKey.mockReturnValueOnce({
        modelInfo: { model: testConv1.model },
        version: undefined,
        name: testConv1.name,
      });
      const expected = {
        name: testConv1.name,
        folderId: testConv1.folderId,
        model: testConv1.model,
        id: 'conversations/my-bucket/test1',
      };

      expect(getConversationInfoFromId(testConv1.id)).toEqual(expected);
    });
  });

  describe('sortByDateAndName', () => {
    it('Should sort conversations by date and name', () => {
      expect(sortByDateAndName([testConv1, testConv2])).toEqual([
        testConv2,
        testConv1,
      ]);
    });
  });

  describe('isValidConversationForCompare', () => {
    it('Should return false if replay, playback, local or with invalid name or path', () => {
      mockFns.isConversationWithFormSchema.mockReturnValueOnce(false);
      mockFns.isEntityIdLocal.mockReturnValueOnce(true);
      mockFns.isEntityNameOrPathInvalid.mockReturnValueOnce(true);

      expect(isValidConversationForCompare(testConv1, testConv2)).toBe(false);
      expect(isValidConversationForCompare(testConv1, testConv2)).toBe(false);
      expect(
        isValidConversationForCompare(testConv1, {
          ...testConv2,
          isReplay: true,
        }),
      ).toBe(false);
      expect(
        isValidConversationForCompare(testConv1, {
          ...testConv2,
          isPlayback: true,
        }),
      ).toBe(false);
    });
    it('Should return false if conversation is with form schema', () => {
      mockFns.isConversationWithFormSchema.mockReturnValueOnce(true);
      mockFns.isEntityIdLocal.mockReturnValueOnce(false);
      mockFns.isEntityNameOrPathInvalid.mockReturnValueOnce(false);

      expect(isValidConversationForCompare(testConv1, testConv2)).toBe(false);
    });
    it('Should return false if conversation ids are same or names are different', () => {
      mockFns.isConversationWithFormSchema.mockReturnValue(false);
      mockFns.isEntityIdLocal.mockReturnValue(false);
      mockFns.isEntityNameOrPathInvalid.mockReturnValue(false);

      expect(isValidConversationForCompare(testConv1, testConv1)).toBe(false);
      expect(isValidConversationForCompare(testConv1, testConv2)).toBe(false);
    });
    it('Should return true for different name conversations if dontCompareNames is true', () => {
      mockFns.isConversationWithFormSchema.mockReturnValueOnce(false);
      mockFns.isEntityIdLocal.mockReturnValueOnce(false);
      mockFns.isEntityNameOrPathInvalid.mockReturnValueOnce(false);

      expect(isValidConversationForCompare(testConv1, testConv2, true)).toBe(
        true,
      );
    });
    it('Should return true for valid conversations with different ids and same names', () => {
      mockFns.isConversationWithFormSchema.mockReturnValueOnce(false);
      mockFns.isEntityIdLocal.mockReturnValueOnce(false);
      mockFns.isEntityNameOrPathInvalid.mockReturnValueOnce(false);

      expect(
        isValidConversationForCompare(testConv1, {
          ...testConv2,
          name: testConv1.name,
        }),
      ).toBe(true);
    });
  });

  describe('isChosenConversationValidForCompare', () => {
    it("Should return false if chosenConversation is replay or playback or it's not loaded", () => {
      expect(
        isChosenConversationValidForCompare(testConv1, {
          ...testConv2,
          isPlayback: true,
          status: UploadStatus.LOADED,
        }),
      ).toBe(false);
      expect(
        isChosenConversationValidForCompare(testConv1, {
          ...testConv2,
          isReplay: true,
          status: UploadStatus.LOADED,
        }),
      ).toBe(false);
      expect(isChosenConversationValidForCompare(testConv1, testConv2)).toBe(
        false,
      );
    });
    it('Should return false for same conversations', () => {
      expect(
        isChosenConversationValidForCompare(testConv1, {
          ...testConv1,
          status: UploadStatus.LOADED,
        }),
      ).toBe(false);
    });
    it('Should return false for conversations with different user messages amount', () => {
      expect(
        isChosenConversationValidForCompare(
          {
            ...testConv1,
            messages: [testMessage1, testMessage2, testMessage3],
          },
          {
            ...testConv2,
            status: UploadStatus.LOADED,
            messages: [testMessage1, testMessage2],
          },
        ),
      ).toBe(false);
    });
    it('Should return true for valid conversations with same user messages amount', () => {
      expect(
        isChosenConversationValidForCompare(
          {
            ...testConv1,
            messages: [testMessage1, testMessage2, testMessage3],
          },
          {
            ...testConv2,
            status: UploadStatus.LOADED,
            messages: [testMessage1, testMessage2, testMessage3],
          },
        ),
      ).toBe(true);
    });
  });

  describe('getOpenAIEntityFullName', () => {
    it('Should return name or id of a passed model', () => {
      expect(
        getOpenAIEntityFullName({ name: 'test-model', id: 'test-model-id' }),
      ).toBe('test-model');
      expect(getOpenAIEntityFullName({ id: 'test-model-id' })).toBe(
        'test-model-id',
      );
    });
  });

  describe('addPausedError', () => {
    it('Should return original messages if every model have allowResume feature', () => {
      const messages = [testMessage1, testMessage2, testMessage3];

      expect(
        addPausedError(
          testConv1,
          [
            { features: { allowResume: true } },
            { features: { allowResume: true } },
          ] as DialAIEntityModel[],
          messages,
        ),
      ).toEqual(messages);
    });
    it('Should return original messages if no assistant message or last message is sent by user', () => {
      expect(
        addPausedError(
          testConv1,
          [{ features: {} } as DialAIEntityModel],
          [testMessage1, testMessage2, testMessage3],
        ),
      ).toEqual([testMessage1, testMessage2, testMessage3]);
      expect(
        addPausedError(
          testConv1,
          [{ features: {} } as DialAIEntityModel],
          [testMessage1],
        ),
      ).toEqual([testMessage1]);
    });
    it('Should return updated messages with error', () => {
      const expectedMessage = {
        ...testMessage2,
        errorMessage:
          'Response generation was stopped. Please regenerate to continue working with conversation',
      };

      expect(
        addPausedError(
          testConv2,
          [{ features: {} } as DialAIEntityModel],
          [testMessage1, testMessage2],
        ),
      ).toEqual([testMessage1, expectedMessage]);
    });

    it('Should return updated messages with previous error if existed', () => {
      const expectedMessage = {
        ...testMessage2,
        errorMessage: 'test-error-message',
      };

      expect(
        addPausedError(
          testConv2,
          [{ features: {} } as DialAIEntityModel],
          [testMessage1, expectedMessage],
        ),
      ).toEqual([testMessage1, expectedMessage]);
    });
    it('Should return updated messages with error and completed stages with other custom content', () => {
      const message: Message = {
        ...testMessage2,
        errorMessage: 'test-error-message',
        custom_content: {
          stages: [
            { index: 0, name: 'stage-1', status: 'completed' },
            { index: 1, name: 'stage-2', status: 'completed' },
            { index: 2, name: 'stage-3', status: null },
          ],
          attachments: [
            {
              type: 'text/plain',
              title: '',
              reference_url: 'test-ref-1',
            },
          ],
        },
      };
      const expectedMessage = {
        ...message,
        custom_content: {
          ...message.custom_content,
          stages: message.custom_content?.stages?.filter(
            (s) => s.status !== null,
          ),
        },
      };

      expect(
        addPausedError(
          testConv2,
          [{ features: {} } as DialAIEntityModel],
          [testMessage1, message],
        ),
      ).toEqual([testMessage1, expectedMessage]);
    });
  });

  describe('getConversationModelParams', () => {
    it('Should return replay settings for replayAsIs conversation', () => {
      expect(
        getConversationModelParams(
          { ...testConv1, replay: { isReplay: true } },
          REPLAY_AS_IS_MODEL,
          {},
        ),
      ).toEqual({
        replay: {
          isReplay: true,
          replayAsIs: true,
        },
      });
    });
    it('Should return replay settings for replay conversation', () => {
      const replay = {
        isReplay: true,
        replayAsIs: false,
        isError: false,
      };

      expect(
        getConversationModelParams({ ...testConv1, replay }, 'test', {
          test: { reference: 'test-ref' } as DialAIEntityModel,
        }),
      ).toEqual({
        replay,
        model: { id: 'test-ref' },
      });
    });
    it('Should return empty settings for undefined modelId', () => {
      expect(getConversationModelParams(testConv1, undefined, {})).toEqual({});
      expect(getConversationModelParams(testConv1, 'some-model', {})).toEqual(
        {},
      );
    });
    it('Should return model and empty replay for non replay conversation', () => {
      expect(
        getConversationModelParams(testConv1, 'test', {
          test: { reference: 'test-ref' } as DialAIEntityModel,
        }),
      ).toEqual({
        replay: undefined,
        model: { id: 'test-ref' },
      });
    });
  });

  describe('isSystemMessage', () => {
    it('Should return true if message have System role', () => {
      expect(isSystemMessage(testMessage5)).toBe(true);
    });
    it('Should return false for non System messages and undefined', () => {
      expect(isSystemMessage(testMessage1)).toBe(false);
      expect(isSystemMessage(testMessage2)).toBe(false);
      expect(isSystemMessage(undefined)).toBe(false);
    });
  });

  describe('excludeSystemMessages', () => {
    it('Should return messages after excluding ones with System role', () => {
      expect(
        excludeSystemMessages([testMessage1, testMessage5, testMessage3]),
      ).toEqual([testMessage1, testMessage3]);
      expect(
        excludeSystemMessages([testMessage1, testMessage2, testMessage3]),
      ).toEqual([testMessage1, testMessage2, testMessage3]);
    });
  });

  describe('getSystemMessageContent', () => {
    it('Should return first system message content or undefined', () => {
      expect(
        getSystemMessageContent([
          testMessage1,
          testMessage2,
          testMessage5,
          testMessage3,
        ]),
      ).toBe(testMessage5.content);
      expect(
        getSystemMessageContent([testMessage1, testMessage2, testMessage3]),
      ).toBe(undefined);
    });
  });

  describe('getDefaultModelReference', () => {
    it('Should return first modelReference that matches defaultModel', () => {
      expect(
        getDefaultModelReference({
          recentModelReferences: ['test3'],
          defaultModelReference: 'test2',
          modelReferences: ['test1', 'test2'],
        }),
      ).toBe('test2');
    });
    it('Should return first recent model if non of modelReferences match', () => {
      expect(
        getDefaultModelReference({
          recentModelReferences: ['test3'],
          defaultModelReference: 'test4',
          modelReferences: ['test1', 'test2'],
        }),
      ).toBe('test3');
    });
    it('Should return first of modelReferences if no match and no recentModelRefences', () => {
      expect(
        getDefaultModelReference({
          recentModelReferences: [],
          defaultModelReference: 'test4',
          modelReferences: ['test1', 'test2'],
        }),
      ).toBe('test1');
    });
  });

  describe('isOldConversationReplay', () => {
    it('Should return true if all conditions for old replay settings are true', () => {
      const messages1 = [
        testMessage1,
        { ...testMessage3, model: { id: 'model1' } },
      ];
      const messages2 = [
        { ...testMessage1, model: { id: 'model1' } },
        { ...testMessage3, model: { id: 'model1' } },
      ];

      expect(
        isOldConversationReplay({
          isReplay: true,
          replayUserMessagesStack: messages1,
        }),
      ).toBe(true);
      expect(
        isOldConversationReplay({
          isReplay: false,
          replayUserMessagesStack: messages1,
        }),
      ).toBe(false);
      expect(
        isOldConversationReplay({
          isReplay: true,
          replayUserMessagesStack: messages2,
        }),
      ).toBe(false);
      expect(isOldConversationReplay(undefined)).toBe(false);
    });
  });

  describe('isPlaybackConversation', () => {
    it('Should return true if conversation have isPlayback flag as true', () => {
      expect(
        isPlaybackConversation({
          ...testConv1,
          playback: { isPlayback: true },
        } as ConversationInfo),
      ).toBe(true);
      expect(isPlaybackConversation({ ...testConv1, isPlayback: true })).toBe(
        true,
      );
      expect(isPlaybackConversation(testConv1)).toBe(false);
    });
  });

  describe('isReplayConversation', () => {
    it('Should return true if conversation have isReplay flag as true', () => {
      expect(
        isReplayConversation({
          ...testConv1,
          replay: { isReplay: true },
        } as ConversationInfo),
      ).toBe(true);
      expect(isReplayConversation({ ...testConv1, isReplay: true })).toBe(true);
      expect(isReplayConversation(testConv1)).toBe(false);
    });
  });

  describe('isReplayAsIsConversation', () => {
    it('Should return true if conversation have replayAsIs flag as true', () => {
      expect(
        isReplayAsIsConversation({
          ...testConv1,
          replay: { replayAsIs: true },
        } as ConversationInfo),
      ).toBe(true);
      expect(isReplayAsIsConversation(testConv1)).toBe(false);
    });
  });

  describe('getQuickAttachmentsSavingPath', () => {
    it('Should return quick attachments saving path for current data', () => {
      mockFns.getFileRootId.mockReturnValue(`${ApiKeys.Files}/${bucket}`);
      vi.useFakeTimers();

      vi.setSystemTime(new Date(2025, 0, 1));
      expect(getQuickAttachmentsSavingPath()).toBe(
        `${ApiKeys.Files}/${bucket}/uploads/2025-01`,
      );

      vi.setSystemTime(new Date(2025, 4, 1));
      expect(getQuickAttachmentsSavingPath()).toBe(
        `${ApiKeys.Files}/${bucket}/uploads/2025-05`,
      );

      vi.setSystemTime(new Date(2025, 10, 1));
      expect(getQuickAttachmentsSavingPath()).toBe(
        `${ApiKeys.Files}/${bucket}/uploads/2025-11`,
      );
    });
  });

  describe('updateMessagesAttachmentsTitles', () => {
    it('Should update attachments titles if included in given titlesToUpdate', () => {
      const messageWithUpdatedTitle1 = {
        ...testMessage3,
        custom_content: {
          attachments: [
            {
              ...testMessage3.custom_content.attachments[0],
              title: 'testUrl3',
            },
          ],
        },
      };
      const messageWithUpdatedTitle2 = {
        ...testMessage4,
        custom_content: {
          attachments: [
            {
              ...testMessage4.custom_content.attachments[0],
              title: 'testUrl4',
            },
          ],
        },
      };
      expect(
        updateMessagesAttachmentsTitles(
          [testMessage3, testMessage4],
          ['testUrl3'],
        ),
      ).toEqual([messageWithUpdatedTitle1, testMessage4]);
      expect(
        updateMessagesAttachmentsTitles(
          [testMessage3, testMessage4],
          ['testUrl3', 'testUrl4'],
        ),
      ).toEqual([messageWithUpdatedTitle1, messageWithUpdatedTitle2]);
      expect(
        updateMessagesAttachmentsTitles([testMessage3, testMessage4], []),
      ).toEqual([testMessage3, testMessage4]);
    });
  });

  describe('updateAttachmentUrlOnMove', () => {
    const oldFolderId = `${ApiKeys.Files}/${bucket}/OldFolder`;
    const newFolderId = `${ApiKeys.Files}/${bucket}/NewFolder`;
    const folderMove = [
      { sourceUrl: oldFolderId, destinationUrl: newFolderId },
    ];

    it('Should rewrite a url matching a moved folder prefix', () => {
      expect(
        updateAttachmentUrlOnMove(`${oldFolderId}/file.svg`, folderMove),
      ).toBe(`${newFolderId}/file.svg`);
    });

    it('Should rewrite a url in nested subfolders of a moved folder', () => {
      expect(
        updateAttachmentUrlOnMove(`${oldFolderId}/sub/file.svg`, folderMove),
      ).toBe(`${newFolderId}/sub/file.svg`);
    });

    it('Should rewrite a url matching a moved file exactly', () => {
      const fileMove = [
        {
          sourceUrl: `${oldFolderId}/file.svg`,
          destinationUrl: `${newFolderId}/renamed.svg`,
        },
      ];
      expect(
        updateAttachmentUrlOnMove(`${oldFolderId}/file.svg`, fileMove),
      ).toBe(`${newFolderId}/renamed.svg`);
    });

    it('Should leave urls outside any moved folder unchanged', () => {
      const url = `${ApiKeys.Files}/${bucket}/OtherFolder/file.svg`;
      expect(updateAttachmentUrlOnMove(url, folderMove)).toBe(url);
    });

    it('Should not rewrite a folder whose id only shares a name prefix', () => {
      const url = `${ApiKeys.Files}/${bucket}/OldFolderExtra/file.svg`;
      expect(updateAttachmentUrlOnMove(url, folderMove)).toBe(url);
    });

    it('Should leave external links unchanged', () => {
      const link = 'https://example.com/OldFolder/file.svg';
      expect(updateAttachmentUrlOnMove(link, folderMove)).toBe(link);
    });

    it('Should return undefined url as is', () => {
      expect(updateAttachmentUrlOnMove(undefined, folderMove)).toBeUndefined();
    });
  });

  describe('updateMessagesAttachmentsOnMove', () => {
    const oldFolderId = `${ApiKeys.Files}/${bucket}/OldFolder`;
    const newFolderId = `${ApiKeys.Files}/${bucket}/NewFolder`;
    const moves = [{ sourceUrl: oldFolderId, destinationUrl: newFolderId }];

    it('Should rewrite affected attachment url and reference_url and flag as updated', () => {
      const messages = [
        {
          content: '',
          role: Role.User,
          custom_content: {
            attachments: [
              {
                type: 'image/svg+xml',
                title: 'icon',
                url: `${oldFolderId}/file.svg`,
                reference_url: `${oldFolderId}/file.svg`,
              },
            ],
          },
        },
      ];

      const result = updateMessagesAttachmentsOnMove(messages, moves);

      expect(result.isUpdated).toBe(true);
      expect(result.messages[0].custom_content?.attachments?.[0]).toMatchObject(
        {
          url: `${newFolderId}/file.svg`,
          reference_url: `${newFolderId}/file.svg`,
        },
      );
    });

    it('Should return the same messages reference when nothing is affected', () => {
      const messages = [
        {
          content: '',
          role: Role.User,
          custom_content: {
            attachments: [
              {
                type: 'image/svg+xml',
                title: 'icon',
                url: `${ApiKeys.Files}/${bucket}/OtherFolder/file.svg`,
              },
            ],
          },
        },
      ];

      const result = updateMessagesAttachmentsOnMove(messages, moves);

      expect(result.isUpdated).toBe(false);
      expect(result.messages).toBe(messages);
    });

    it('Should leave messages without attachments untouched', () => {
      const messages = [{ content: 'no attachments', role: Role.User }];

      const result = updateMessagesAttachmentsOnMove(messages, moves);

      expect(result.isUpdated).toBe(false);
      expect(result.messages).toBe(messages);
    });
  });

  describe('isConversationInfoEntity', () => {
    it('Should return true if entity have conversation id', () => {
      expect(isConversationInfoEntity(testConv1)).toBe(true);
      expect(isConversationInfoEntity({ id: 'not-conv' } as ShareEntity)).toBe(
        false,
      );
      expect(
        isConversationInfoEntity({
          ...testConv1,
          id: `${ApiKeys.Prompts}/${bucket}`,
        }),
      ).toBe(false);
    });
  });

  describe('isLoadedConversationEntity', () => {
    it('Should return true for loaded conversation entities', () => {
      expect(isLoadedConversationEntity(testConv1)).toBe(false);
      expect(
        isLoadedConversationEntity({
          ...testConv1,
          status: UploadStatus.LOADED,
        }),
      ).toBe(true);
      expect(
        isLoadedConversationEntity({
          id: 'not-conv',
          status: UploadStatus.LOADED,
        } as ShareEntity),
      ).toBe(false);
    });
  });

  describe('getMessageCustomContent', () => {
    it('Should return undefined if message has no custom_content', () => {
      expect(getMessageCustomContent(testMessage1)).toBe(undefined);
      expect(getMessageCustomContent(testMessage2)).toBe(undefined);
      expect(
        getMessageCustomContent({ ...testMessage1, custom_content: {} }),
      ).toBe(undefined);
    });
    it('Should return custom_content with attachments for user messages', () => {
      const expected = {
        custom_content: {
          attachments: testMessage3.custom_content.attachments,
        },
      };
      expect(getMessageCustomContent(testMessage3)).toEqual(expected);
    });
    it('Should exclude attachments for assistant messages by default', () => {
      const message = {
        ...testMessage2,
        custom_content: {
          attachments: [{ type: 'text/plain', title: 'test', url: 'test-url' }],
          state: { field: 'test' },
          form_value: { key: 'value' },
        },
      };
      const expected = {
        custom_content: {
          state: { field: 'test' },
          form_value: { key: 'value' },
        },
      };
      expect(getMessageCustomContent(message)).toEqual(expected);
    });
    it('Should include attachments for assistant messages when allowAssistantAttachments is true', () => {
      const message = {
        ...testMessage2,
        custom_content: {
          attachments: [
            {
              type: 'text/plain',
              title: 'test',
              url: 'test-url',
            },
          ],
        },
      };
      const expected = {
        custom_content: {
          attachments: message.custom_content.attachments,
        },
      };
      expect(getMessageCustomContent(message, true)).toEqual(expected);
    });
    it('Should return custom_content for attachments, state, form_value and form_schema', () => {
      const message = {
        ...testMessage1,
        custom_content: {
          attachments: [
            {
              type: 'text/plain',
              title: 'Test Document',
              url: `${ApiKeys.Files}/${bucket}/document.txt`,
              reference_url: 'ref-text',
            },
          ],
          state: { field: 'test' },
          form_value: {
            field1: 'value1',
          },
          form_schema: {
            type: 'object',
          } as MessageFormSchema,
        },
      };

      const expected = {
        custom_content: message.custom_content,
      };

      expect(getMessageCustomContent(message)).toEqual(expected);
    });
  });
});
