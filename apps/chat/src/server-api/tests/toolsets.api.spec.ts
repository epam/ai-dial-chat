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
  auth_settings: {
    authentication_type: 'API_KEY',
    api_key_header: 'X-API-Key',
    user_level_auth_status: 'SIGNED_IN',
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
      authSettings: {
        authenticationType: 'API_KEY',
        apiKeyHeader: 'X-API-Key',
        userLevelAuthStatus: 'SIGNED_IN',
      },
    });
  });

  it('normalizes list response items', async () => {
    vi.mocked(toolsetsApi.listToolsets).mockResolvedValue({
      data: [rawSnakeToolset],
    } as DialToolsetListResponseDto);

    const result = await listToolsets();

    expect(result.data[0].displayName).toBe('My toolset');
    expect(result.data[0].authSettings?.authenticationType).toBe('API_KEY');
  });
});
