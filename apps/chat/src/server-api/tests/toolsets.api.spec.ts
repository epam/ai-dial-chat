import type {
  DialToolsetDto,
  DialToolsetListResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toolsetsApi } from '../api-client';
import { getToolset, listToolsets } from '../toolsets';

vi.mock('../api-client', () => ({
  toolsetsApi: {
    getToolset: vi.fn(),
    listToolsets: vi.fn(),
  },
}));

const mockToolset: DialToolsetDto = {
  id: 'toolsets/b/my__1.0.0',
  toolset: 'toolsets/b/my__1.0.0',
  displayName: 'My toolset',
  displayVersion: '1.0.0',
  iconUrl: 'https://example.com/icon.svg',
  descriptionKeywords: ['search'],
  maxRetryAttempts: 3,
  createdAt: 100,
  updatedAt: 200,
  endpoint: 'https://example.com/mcp',
  transport: 'HTTP',
  allowedTools: ['lookup'],
  features: {
    mcp: true,
    chatCompletion: false,
    responsesApi: false,
    allowResume: true,
    parallelToolCalls: true,
    maxTokensSupported: true,
    reasoningEfforts: [],
  },
  authSettings: {
    authenticationType: 'OAUTH',
    clientId: 'my-client-id',
    redirectUri: 'https://example.com/callback',
    codeChallenge: 'challenge-value',
    codeChallengeMethod: 'S256',
    authorizationEndpoint: 'https://example.com/authorize',
    tokenEndpoint: 'https://example.com/token',
    scopesSupported: ['read', 'write'],
    globalAuthStatus: 'SIGNED_OUT',
    userLevelAuthStatus: 'SIGNED_IN',
  },
  isMy: false,
  canEdit: true,
  sharedWithMe: true,
};

describe('toolsets API adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes getToolset response through unchanged', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue(mockToolset);

    const result = await getToolset('toolsets/b/my__1.0.0');

    expect(result).toEqual(mockToolset);
  });

  it('passes listToolsets response through unchanged', async () => {
    const mockList: DialToolsetListResponseDto = { data: [mockToolset] };
    vi.mocked(toolsetsApi.listToolsets).mockResolvedValue(mockList);

    const result = await listToolsets();

    expect(result).toEqual(mockList);
  });
});
