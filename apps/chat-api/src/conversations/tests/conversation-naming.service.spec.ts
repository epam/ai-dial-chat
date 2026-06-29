import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../../app-config/app-config.service';
import { FeatureKey } from '../../app-config/feature-flags/feature-key.enum';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import { ConversationNamingService } from '../conversation-naming.service';
import { ConversationMessageRole } from '../dto/conversation-message.dto';
import { CONVERSATION_NAMING_SYSTEM_PROMPT } from '../prompts/conversation-naming.prompt';

const makeConversation = (
  overrides: Partial<ConversationResponseDto> = {},
): ConversationResponseDto => ({
  id: 'test-bucket/gpt-4o__Hello',
  folderId: 'test-bucket',
  name: 'Hello',
  model: { id: 'gpt-4o' },
  prompt: '',
  temperature: 1,
  messages: [
    {
      id: 'user-1',
      role: ConversationMessageRole.User,
      content: 'How does Docker networking work?',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'assistant-1',
      role: ConversationMessageRole.Assistant,
      content: 'Docker uses bridge networks by default.',
      timestamp: new Date().toISOString(),
    },
  ],
  lastActivityDate: Date.now(),
  updatedAt: Date.now(),
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
  ...overrides,
});

describe('ConversationNamingService', () => {
  let service: ConversationNamingService;
  let mockAppConfigService: { isEnabled: ReturnType<typeof vi.fn> };
  let mockConversationPersistence: {
    getConversation: ReturnType<typeof vi.fn>;
    saveConversation: ReturnType<typeof vi.fn>;
  };
  let mockConfigService: Partial<ConfigService<EnvironmentVariables>>;

  beforeEach(() => {
    mockAppConfigService = {
      isEnabled: vi.fn().mockResolvedValue(true),
    };
    mockConversationPersistence = {
      getConversation: vi
        .fn()
        .mockResolvedValue(
          makeConversation({ name: 'Docker networking basics' }),
        ),
      saveConversation: vi.fn().mockResolvedValue(makeConversation()),
    };
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'DIAL_CORE_URL') return 'http://localhost:3000';
        if (key === 'UTILITY_MODEL') return 'utility-model';
        if (key === 'DIAL_API_KEY') return 'dial-api-key';
        if (key === 'UTILITY_NAMING_TIMEOUT_MS') return 10_000;
        return undefined;
      }),
    };

    service = new ConversationNamingService(
      mockConfigService as ConfigService<EnvironmentVariables>,
      mockAppConfigService as unknown as AppConfigService,
      mockConversationPersistence,
    );

    vi.spyOn(service['client'], 'sendChatCompletionRequest').mockResolvedValue({
      response: { ok: true },
      data: {
        choices: [{ message: { content: 'Docker networking basics' } }],
      },
    } as never);
  });

  it('renames the conversation after a successful LLM response', async () => {
    await service['runMaybeRenameAfterFirstReply'](
      'gpt-4o__Hello',
      'test-token',
      'test-bucket',
      makeConversation(),
    );

    expect(mockAppConfigService.isEnabled).toHaveBeenCalledWith(
      FeatureKey.LlmConversationNaming,
      expect.any(Object),
    );
    expect(service['client'].sendChatCompletionRequest).toHaveBeenCalledWith(
      'utility-model',
      expect.objectContaining({
        body: expect.objectContaining({
          stream: false,
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: CONVERSATION_NAMING_SYSTEM_PROMPT,
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining(
                'How does Docker networking work?',
              ),
            }),
          ]),
        }),
        headers: { 'Api-Key': 'dial-api-key' },
      }),
    );
    expect(mockConversationPersistence.getConversation).toHaveBeenCalledWith(
      'gpt-4o__Hello',
      'test-token',
      'test-bucket',
    );
    expect(mockConversationPersistence.saveConversation).toHaveBeenCalledWith(
      'gpt-4o__Hello',
      'test-token',
      'test-bucket',
      expect.objectContaining({
        name: 'Docker networking basics',
        llmNamingDone: true,
      }),
    );
  });

  it('skips naming when DIAL_API_KEY is not configured', async () => {
    vi.mocked(mockConfigService.get).mockImplementation((key: string) => {
      if (key === 'DIAL_CORE_URL') return 'http://localhost:3000';
      if (key === 'UTILITY_MODEL') return 'utility-model';
      if (key === 'UTILITY_NAMING_TIMEOUT_MS') return 10_000;
      return undefined;
    });

    await service['runMaybeRenameAfterFirstReply'](
      'gpt-4o__Hello',
      'test-token',
      'test-bucket',
      makeConversation(),
    );

    expect(service['client'].sendChatCompletionRequest).not.toHaveBeenCalled();
  });

  it('skips naming when the feature flag is off', async () => {
    mockAppConfigService.isEnabled.mockResolvedValue(false);

    await service['runMaybeRenameAfterFirstReply'](
      'gpt-4o__Hello',
      'test-token',
      'test-bucket',
      makeConversation(),
    );

    expect(service['client'].sendChatCompletionRequest).not.toHaveBeenCalled();
  });

  it('skips naming when llmNamingDone is already true', async () => {
    await service['runMaybeRenameAfterFirstReply'](
      'gpt-4o__Hello',
      'test-token',
      'test-bucket',
      makeConversation({ llmNamingDone: true }),
    );

    expect(service['client'].sendChatCompletionRequest).not.toHaveBeenCalled();
  });

  it('skips naming when there are more than two non-status messages', async () => {
    const conversation = makeConversation({
      messages: [
        {
          id: 'user-1',
          role: ConversationMessageRole.User,
          content: 'Hello',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'assistant-1',
          role: ConversationMessageRole.Assistant,
          content: 'Hi',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'user-2',
          role: ConversationMessageRole.User,
          content: 'Follow up',
          timestamp: new Date().toISOString(),
        },
      ],
    });

    await service['runMaybeRenameAfterFirstReply'](
      'gpt-4o__Hello',
      'test-token',
      'test-bucket',
      conversation,
    );

    expect(service['client'].sendChatCompletionRequest).not.toHaveBeenCalled();
  });

  it('keeps the original name when the LLM call times out', async () => {
    vi.useFakeTimers();
    vi.spyOn(service['client'], 'sendChatCompletionRequest').mockImplementation(
      (_modelId, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }) as never,
    );

    const promise = service['runMaybeRenameAfterFirstReply'](
      'gpt-4o__Hello',
      'test-token',
      'test-bucket',
      makeConversation(),
    );

    await vi.advanceTimersByTimeAsync(10_000);
    await promise;

    expect(mockConversationPersistence.saveConversation).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('keeps the original name when the LLM response is empty', async () => {
    vi.spyOn(service['client'], 'sendChatCompletionRequest').mockResolvedValue({
      response: { ok: true },
      data: { choices: [{ message: { content: '   ' } }] },
    } as never);

    await service['runMaybeRenameAfterFirstReply'](
      'gpt-4o__Hello',
      'test-token',
      'test-bucket',
      makeConversation(),
    );

    expect(mockConversationPersistence.saveConversation).not.toHaveBeenCalled();
  });

  it('skips save when llmNamingDone is already true after refresh', async () => {
    mockConversationPersistence.getConversation.mockResolvedValue(
      makeConversation({ llmNamingDone: true }),
    );

    await service['runMaybeRenameAfterFirstReply'](
      'gpt-4o__Hello',
      'test-token',
      'test-bucket',
      makeConversation(),
    );

    expect(mockConversationPersistence.saveConversation).not.toHaveBeenCalled();
  });

  it('skips concurrent rename attempts for the same conversation id', async () => {
    let releaseCompletion: () => void = () => undefined;
    const completionGate = new Promise<void>((resolve) => {
      releaseCompletion = resolve;
    });

    vi.spyOn(service['client'], 'sendChatCompletionRequest').mockImplementation(
      () =>
        completionGate.then(() => ({
          response: { ok: true },
          data: {
            choices: [{ message: { content: 'Docker networking basics' } }],
          },
        })) as never,
    );

    const conversation = makeConversation();
    const first = service['runMaybeRenameAfterFirstReply'](
      'gpt-4o__Hello',
      'test-token',
      'test-bucket',
      conversation,
    );
    await Promise.resolve();
    const second = service['runMaybeRenameAfterFirstReply'](
      'gpt-4o__Hello',
      'test-token',
      'test-bucket',
      conversation,
    );

    releaseCompletion();
    await Promise.all([first, second]);

    expect(service['client'].sendChatCompletionRequest).toHaveBeenCalledTimes(
      1,
    );
  });
});
