import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JWT } from 'next-auth/jwt';

import { EntityType } from '@/src/types/common';
import { TokenizerModel } from '@/src/types/models';

import {
  DEFAULT_MODEL_ID,
  MAX_PROMPT_TOKENS_DEFAULT_PERCENT,
  MAX_PROMPT_TOKENS_DEFAULT_VALUE,
} from '@/src/constants/default-server-settings';

import { getEntities } from '../get-entities';
import {
  fixDate,
  getAllEntities,
  getSortedEntities,
  getTiktokenEncoding,
  getTokensPerMessage,
} from '../get-sorted-entities';
import { logger } from '../logger';

// Mock dependencies
vi.mock('../get-entities', () => ({
  getEntities: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../api', () => ({
  ApiUtils: {
    decodeApiUrl: vi.fn((url) => `decoded_${url}`),
  },
}));

vi.mock('../app/file', () => ({
  isAbsoluteUrl: vi.fn((url) => url.startsWith('http')),
}));

describe('getTiktokenEncoding', () => {
  it('should return cl100k_base for GPT_35_TURBO_0301', () => {
    expect(getTiktokenEncoding(TokenizerModel.GPT_35_TURBO_0301)).toBe(
      'cl100k_base',
    );
  });

  it('should return cl100k_base for GPT_4_0314', () => {
    expect(getTiktokenEncoding(TokenizerModel.GPT_4_0314)).toBe('cl100k_base');
  });

  it('should return undefined for unsupported tokenizer model', () => {
    expect(
      getTiktokenEncoding('unsupported' as TokenizerModel),
    ).toBeUndefined();
  });
});

describe('getTokensPerMessage', () => {
  it('should return 4 for GPT_35_TURBO_0301', () => {
    expect(getTokensPerMessage(TokenizerModel.GPT_35_TURBO_0301)).toBe(4);
  });

  it('should return 3 for GPT_4_0314', () => {
    expect(getTokensPerMessage(TokenizerModel.GPT_4_0314)).toBe(3);
  });

  it('should return undefined for unsupported tokenizer model', () => {
    expect(
      getTokensPerMessage('unsupported' as TokenizerModel),
    ).toBeUndefined();
  });
});

describe('fixDate', () => {
  it('should convert 1672534800 to 1740006000000', () => {
    expect(fixDate(1672534800)).toBe(1740006000000);
  });

  it('should keep other dates unchanged', () => {
    const otherDate = 1632534800;
    expect(fixDate(otherDate)).toBe(otherDate);
  });
});

describe('getAllEntities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });
  it('should fetch all entities successfully when all promises are fulfilled', async () => {
    const mockModels = [{ id: 'model1', object: EntityType.Model }];
    const mockApplications = [{ id: 'app1', object: EntityType.Application }];
    const mockAssistants = [{ id: 'assistant1', object: EntityType.Assistant }];
    const accessToken = 'token123';
    const jobTitle = 'Developer';

    vi.mocked(getEntities).mockImplementation((entityType) => {
      if (entityType === EntityType.Model) return Promise.resolve(mockModels);
      if (entityType === EntityType.Application)
        return Promise.resolve(mockApplications);
      if (entityType === EntityType.Assistant)
        return Promise.resolve(mockAssistants);
      return Promise.resolve([]);
    });

    const result = await getAllEntities(accessToken, jobTitle);

    expect(result.models).toEqual(mockModels);
    expect(result.applications).toEqual(mockApplications);
    expect(result.assistants).toEqual(mockAssistants);

    expect(getEntities).toHaveBeenCalledTimes(3);
    expect(getEntities).toHaveBeenCalledWith(
      EntityType.Model,
      accessToken,
      jobTitle,
    );
    expect(getEntities).toHaveBeenCalledWith(
      EntityType.Application,
      accessToken,
      jobTitle,
    );
    expect(getEntities).toHaveBeenCalledWith(
      EntityType.Assistant,
      accessToken,
      jobTitle,
    );
  });

  it('should handle rejected promises and log errors', async () => {
    const error = new Error('Failed to fetch models');
    vi.mocked(getEntities).mockImplementation((entityType) => {
      if (entityType === EntityType.Model) return Promise.reject(error);
      return Promise.resolve([]);
    });

    const result = await getAllEntities('token123', 'Developer');

    expect(result.models).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(error);
  });
});

describe('getSortedEntities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });
  it('should process and format entities correctly', async () => {
    // Mock a model with complete data
    const mockModels = [
      {
        id: DEFAULT_MODEL_ID,
        object: EntityType.Model,
        display_name: 'Test Model',
        display_version: '1.0',
        description: 'A test model',
        description_keywords: ['AI', 'Testing'],
        updated_at: 1600000000,
        created_at: 1500000000,
        owner: 'Test Owner',
        icon_url: '/relative/icon.png',
        capabilities: { chat_completion: true },
        limits: {
          max_total_tokens: 8000,
          max_prompt_tokens: 6000,
          max_completion_tokens: 2000,
        },
        features: {
          system_prompt: true,
          temperature: true,
        },
        tokenizer_model: TokenizerModel.GPT_4_0314,
      },
    ];

    vi.mocked(getEntities).mockImplementation((entityType) => {
      if (entityType === EntityType.Model) return Promise.resolve(mockModels);
      return Promise.resolve([]);
    });

    const token: JWT = { access_token: 'token123', jobTitle: 'Developer' };
    const result = await getSortedEntities(token);

    expect(result).toHaveLength(1);

    const entity = result[0];
    expect(entity.id).toBe(`decoded_${DEFAULT_MODEL_ID}`);
    expect(entity.name).toBe('Test Model');
    expect(entity.isDefault).toBe(true);
    expect(entity.type).toBe(EntityType.Model);
    expect(entity.limits).toEqual({
      maxRequestTokens: 6000,
      maxResponseTokens: 2000,
      maxTotalTokens: 8000,
      isMaxRequestTokensCustom: false,
    });
    expect(entity.tokenizer).toEqual({
      encoding: 'cl100k_base',
      tokensPerMessage: 3,
    });
    expect(entity.iconUrl).toBe('decoded_/relative/icon.png');
    expect(entity.topics).toEqual(['AI', 'Testing']);
  });

  it('should calculate token limits when not explicitly provided', async () => {
    const mockModels = [
      {
        id: DEFAULT_MODEL_ID,
        object: EntityType.Model,
        capabilities: { chat_completion: true },
        limits: {
          max_total_tokens: 4000,
          // Missing prompt and completion token limits
        },
      },
    ];

    vi.mocked(getEntities).mockImplementation((entityType) => {
      if (entityType === EntityType.Model) return Promise.resolve(mockModels);
      return Promise.resolve([]);
    });

    const token: JWT = { access_token: 'token123', jobTitle: 'Developer' };
    const result = await getSortedEntities(token);

    const entity = result[0];
    expect(entity.limits).toBeDefined();

    // Should calculate response tokens based on default percentage
    const expectedResponseTokens = Math.min(
      MAX_PROMPT_TOKENS_DEFAULT_VALUE,
      Math.floor((MAX_PROMPT_TOKENS_DEFAULT_PERCENT * 4000) / 100),
    );

    expect(entity.limits?.maxResponseTokens).toBe(expectedResponseTokens);
    expect(entity.limits?.maxRequestTokens).toBe(4000 - expectedResponseTokens);
    expect(entity.limits?.isMaxRequestTokensCustom).toBe(true);
  });

  it('should handle absolute URLs correctly', async () => {
    const mockModels = [
      {
        id: DEFAULT_MODEL_ID,
        object: EntityType.Model,
        capabilities: { chat_completion: true },
        icon_url: 'http://example.com/icon.png',
      },
    ];

    vi.mocked(getEntities).mockImplementation((entityType) => {
      if (entityType === EntityType.Model) return Promise.resolve(mockModels);
      return Promise.resolve([]);
    });

    const token = { access_token: 'token123', jobTitle: 'Developer' } as any;
    const result = await getSortedEntities(token);

    expect(result[0].iconUrl).toBe('http://example.com/icon.png');
  });

  it('should filter out entities with embeddings capability or without chat_completion', async () => {
    const mockModels = [
      {
        id: 'chat-model',
        object: EntityType.Model,
        capabilities: { chat_completion: true },
      },
      {
        id: 'embeddings-model',
        object: EntityType.Model,
        capabilities: { embeddings: true, chat_completion: true },
      },
      {
        id: 'non-chat-model',
        object: EntityType.Model,
        capabilities: { chat_completion: false },
      },
    ];

    vi.mocked(getEntities).mockImplementation((entityType) => {
      if (entityType === EntityType.Model) return Promise.resolve(mockModels);
      return Promise.resolve([]);
    });

    const token: JWT = {
      access_token: 'token123',
      jobTitle: 'Developer',
    };
    const result = await getSortedEntities(token);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('decoded_chat-model');
  });

  it('should log warning when default model is not found', async () => {
    const mockModels = [
      {
        id: 'non-default-model',
        object: EntityType.Model,
        capabilities: { chat_completion: true },
      },
    ];

    vi.mocked(getEntities).mockImplementation((entityType) => {
      if (entityType === EntityType.Model) return Promise.resolve(mockModels);
      return Promise.resolve([]);
    });

    const token: JWT = { access_token: 'token123', jobTitle: 'Developer' };
    const result = await getSortedEntities(token);

    expect(logger.warn).toHaveBeenCalled();
    expect(vi.mocked(logger.warn).mock.calls[0][1]).toContain(
      `Cannot find default model id("${DEFAULT_MODEL_ID}")`,
    );

    // First model should become default
    expect(result[0].isDefault).toBe(true);
  });

  //TODO: Uncomment this test when getSortedEntities handles null token gracefully
  // it('should handle null token gracefully', async () => {
  //   const result = await getSortedEntities(null);

  //   expect(result).toEqual([]);
  //   expect(getEntities).not.toHaveBeenCalled();
  // });
});
