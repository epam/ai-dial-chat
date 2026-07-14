import type {
  DialToolsetDto,
  DialToolsetListResponseDto,
} from '@epam/chat-api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toolsetsApi } from '../api-client';
import { getToolset, listToolsets } from '../toolsets';

vi.mock('../api-client', () => ({
  toolsetsApi: {
    getToolset: vi.fn(),
    listToolsets: vi.fn(),
  },
}));

const rawSnakeToolset = {
  id: 'toolsets/b/my__1.0.0',
  toolset: 'toolsets/b/my__1.0.0',
  display_name: 'My toolset',
  display_version: '1.0.0',
  icon_url: 'https://example.com/icon.svg',
  description_keywords: ['search'],
  max_retry_attempts: 3,
  created_at: 100,
  updated_at: 200,
  endpoint: 'https://example.com/mcp',
  transport: 'HTTP',
  allowed_tools: ['lookup'],
  features: {
    mcp: true,
    chat_completion: false,
    responses_api: false,
    allow_resume: true,
    parallel_tool_calls: true,
    max_tokens_supported: true,
    reasoning_efforts: [],
  },
  auth_settings: {
    authentication_type: 'OAUTH',
    client_id: 'my-client-id',
    redirect_uri: 'https://example.com/callback',
    code_challenge: 'challenge-value',
    code_challenge_method: 'S256',
    authorization_endpoint: 'https://example.com/authorize',
    token_endpoint: 'https://example.com/token',
    scopes_supported: ['read', 'write'],
    global_auth_status: 'SIGNED_OUT',
    user_level_auth_status: 'SIGNED_IN',
  },
} as unknown as DialToolsetDto;

const rawSnakeApiKeyToolset = {
  id: 'toolsets/b/api__1.0.0',
  toolset: 'toolsets/b/api__1.0.0',
  display_name: 'API toolset',
  auth_settings: {
    authentication_type: 'API_KEY',
    api_key_header: 'X-Api-Key',
  },
} as unknown as DialToolsetDto;

describe('toolsets API adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes snake_case fields from getToolset', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue(rawSnakeToolset);

    const result = await getToolset('toolsets/b/my__1.0.0');

    expect(result).toMatchObject({
      displayName: 'My toolset',
      displayVersion: '1.0.0',
      iconUrl: 'https://example.com/icon.svg',
      descriptionKeywords: ['search'],
      maxRetryAttempts: 3,
      createdAt: 100,
      updatedAt: 200,
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
    });
  });

  it('normalizes API key header from snake_case auth settings', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue(rawSnakeApiKeyToolset);

    const result = await getToolset('toolsets/b/api__1.0.0');

    expect(result.authSettings).toMatchObject({
      authenticationType: 'API_KEY',
      apiKeyHeader: 'X-Api-Key',
    });
  });

  it('normalizes list response items', async () => {
    vi.mocked(toolsetsApi.listToolsets).mockResolvedValue({
      data: [rawSnakeToolset],
    } as DialToolsetListResponseDto);

    const result = await listToolsets();

    expect(result.data[0].displayName).toBe('My toolset');
    expect(result.data[0].authSettings?.authenticationType).toBe('OAUTH');
    expect(result.data[0].authSettings?.codeChallenge).toBe('challenge-value');
    expect(result.data[0].authSettings?.tokenEndpoint).toBe(
      'https://example.com/token',
    );
  });
});
