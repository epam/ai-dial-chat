import {
  BadGatewayException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { DialClientService } from '../../dial/dial-client.service';
import { DeploymentsService } from '../deployments.service';
import type { DeploymentItemDto } from '../dto/deployment-item.dto';
import { DeploymentInterfaceType } from '../dto/deployments-query.dto';

const mockModel = {
  id: 'gpt-4o',
  object: 'model',
  display_name: 'GPT-4o',
  interfaces: ['chat'],
};
const mockApplication = {
  id: 'my-app',
  object: 'application',
  display_name: 'My App',
  interfaces: ['custom_ui'],
};
const mockToolset = {
  id: 'search-tool',
  toolset: 'search-tool',
  display_name: 'Search Tool',
  interfaces: ['mcp'],
};
const mockNoId = { object: 'model', display_name: 'No ID' };
const mockNoDisplayName = { id: 'no-name', object: 'model' };

function makeService(
  overrides: {
    cached?: DeploymentItemDto[];
    installedIds?: { toolsets: string[]; deployments: string[] };
  } = {},
) {
  const store = new Map<string, unknown>();
  if (overrides.cached) {
    store.set('deployments:list:user1', overrides.cached);
  }

  const cacheManager = {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
  };

  const sdkClient = {
    listDeployments: vi.fn().mockResolvedValue({
      error: false,
      response: { status: 200 },
      data: [mockModel, mockApplication, mockToolset],
    }),
    configurationDeployment: vi.fn(),
    getDeploymentLimits: vi.fn(),
    getModel: vi.fn(),
    getApplication: vi.fn(),
    getToolset: vi.fn(),
    getToolSetTools: vi.fn(),
    getSharedResources: vi
      .fn()
      .mockResolvedValue({ data: { resources: [] }, error: undefined }),
  };

  const configService = {
    get: vi.fn().mockReturnValue('http://dial-core'),
  } as unknown as ConfigService<EnvironmentVariables>;

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const userConfigService = {
    getInstalledIds: vi
      .fn()
      .mockResolvedValue(
        overrides.installedIds ?? { toolsets: [], deployments: [] },
      ),
  };

  const service = new DeploymentsService(
    dialClient,
    configService,
    cacheManager as never,
    userConfigService as never,
  );

  return { service, sdkClient, cacheManager, userConfigService };
}

const okResponse = <T>(data: T) =>
  ({
    error: undefined,
    response: { status: 200 },
    data,
  }) as never;

const errResponse = (status: number) =>
  ({
    error: true as const,
    response: { status },
    data: undefined,
  }) as never;

describe('DeploymentsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listDeployments', () => {
    it('maps model, application, and toolset correctly', async () => {
      const { service } = makeService();
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments).toHaveLength(3);
      expect(result.deployments.find((d) => d.id === 'gpt-4o')?.type).toBe(
        'model',
      );
      expect(result.deployments.find((d) => d.id === 'my-app')?.type).toBe(
        'application',
      );
      expect(result.deployments.find((d) => d.id === 'search-tool')?.type).toBe(
        'toolset',
      );
    });

    it('skips items without id', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockModel, mockNoId],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].id).toBe('gpt-4o');
    });

    it('falls back displayName to id when display_name is absent', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockNoDisplayName],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].displayName).toBe('no-name');
    });

    it('returns cached value without calling SDK on cache hit', async () => {
      const cached: DeploymentItemDto[] = [
        { id: 'cached', displayName: 'Cached', type: 'model' },
      ];
      const { service, sdkClient } = makeService({ cached });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0]).toMatchObject(cached[0]);
      expect(sdkClient.listDeployments).not.toHaveBeenCalled();
    });

    it('bypasses cached deployments when refresh is true', async () => {
      const cached: DeploymentItemDto[] = [
        { id: 'cached', displayName: 'Cached', type: 'model' },
      ];
      const { service, sdkClient } = makeService({ cached });
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockModel],
      });

      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
        undefined,
        true,
      );

      expect(result.deployments[0].id).toBe(mockModel.id);
      expect(sdkClient.listDeployments).toHaveBeenCalledOnce();
    });

    it('applies interface_type filter in-process after cache hit', async () => {
      const cached: DeploymentItemDto[] = [
        {
          id: 'chat-model',
          displayName: 'Chat',
          type: 'model',
          interfaces: ['chat'],
        },
        {
          id: 'embed-model',
          displayName: 'Embed',
          type: 'model',
          interfaces: ['embedding'],
        },
        { id: 'no-iface', displayName: 'None', type: 'model' },
      ];
      const { service } = makeService({ cached });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
        [DeploymentInterfaceType.Chat],
      );
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].id).toBe('chat-model');
    });

    it('forwards interface_type filter to DIAL Core on cache miss', async () => {
      const { service, sdkClient } = makeService();

      await service.listDeployments('user1', 'token', 'bucket-1', [
        DeploymentInterfaceType.Chat,
        DeploymentInterfaceType.Mcp,
      ]);

      expect(sdkClient.listDeployments).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
          params: {
            query: {
              interface_type: ['chat', 'mcp'],
            },
          },
        }),
      );
    });

    it('maps application_type_schema_id to applicationTypeSchemaId for application deployments', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            application_type_schema_id: 'https://example.com/schemas/quick-app',
          },
        ],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationTypeSchemaId).toBe(
        'https://example.com/schemas/quick-app',
      );
    });

    it('maps Quick Apps conversation starters from application properties', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            application_properties: {
              conversation_starters: {
                intro_text: 'Choose a starting point',
                auto_submit: false,
                chat_message_input_disabled: true,
                starters: [
                  { title: 'Summarize', text: 'Summarize this document' },
                  { title: ' ', text: 'Ignored' },
                  { title: 'Explain', text: 'Explain the key points' },
                ],
              },
            },
          },
        ],
      });

      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );

      expect(result.deployments[0].conversationStarters).toEqual({
        introText: 'Choose a starting point',
        autoSubmit: false,
        chatMessageInputDisabled: true,
        starters: [
          { title: 'Summarize', text: 'Summarize this document' },
          { title: 'Explain', text: 'Explain the key points' },
        ],
      });
    });

    it('does not set applicationTypeSchemaId for model deployments', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockModel],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationTypeSchemaId).toBeUndefined();
    });

    it('maps input_attachment_types to inputAttachmentTypes', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          { ...mockModel, input_attachment_types: ['audio/*', 'image/*'] },
        ],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].inputAttachmentTypes).toEqual([
        'audio/*',
        'image/*',
      ]);
    });

    it('leaves inputAttachmentTypes undefined when source field is absent', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockModel],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].inputAttachmentTypes).toBeUndefined();
    });

    it('throws BadGatewayException when DIAL Core returns non-2xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: true,
        response: { status: 502 },
        data: undefined,
      });
      await expect(
        service.listDeployments('user1', 'token', 'bucket-1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException when DIAL Core is unreachable', async () => {
      const { service, sdkClient } = makeService();
      const abortError = new Error('fetch failed');
      abortError.name = 'AbortError';
      sdkClient.listDeployments.mockRejectedValue(abortError);
      await expect(
        service.listDeployments('user1', 'token', 'bucket-1'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('sets isInstalled=true for installed model and application deployments', async () => {
      const { service } = makeService({
        installedIds: { toolsets: [], deployments: ['gpt-4o', 'my-app'] },
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(
        result.deployments.find((d) => d.id === 'gpt-4o')?.isInstalled,
      ).toBe(true);
      expect(
        result.deployments.find((d) => d.id === 'my-app')?.isInstalled,
      ).toBe(true);
      expect(
        result.deployments.find((d) => d.id === 'search-tool')?.isInstalled,
      ).toBe(false);
    });

    it('sets isInstalled=true for installed toolset', async () => {
      const { service } = makeService({
        installedIds: { toolsets: ['search-tool'], deployments: [] },
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(
        result.deployments.find((d) => d.id === 'search-tool')?.isInstalled,
      ).toBe(true);
      expect(
        result.deployments.find((d) => d.id === 'gpt-4o')?.isInstalled,
      ).toBe(false);
    });

    it('sets isInstalled=false for all items when nothing is installed', async () => {
      const { service } = makeService();
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments.every((d) => d.isInstalled === false)).toBe(
        true,
      );
    });

    it('passes token and bucket to userConfigService.getInstalledIds', async () => {
      const { service, userConfigService } = makeService();
      await service.listDeployments('user1', 'my-token', 'my-bucket');
      expect(userConfigService.getInstalledIds).toHaveBeenCalledWith(
        'my-token',
        'my-bucket',
      );
    });

    it('overlays isInstalled after cache hit', async () => {
      const cached: DeploymentItemDto[] = [
        { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
      ];
      const { service } = makeService({
        cached,
        installedIds: { toolsets: [], deployments: ['gpt-4o'] },
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].isInstalled).toBe(true);
    });

    it('forwards owner when present in raw payload', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockModel, owner: 'users/alice@example.com' }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].owner).toBe('users/alice@example.com');
    });

    it('leaves owner undefined when not in raw payload', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockModel],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].owner).toBeUndefined();
    });

    it('forwards intro when present in raw payload', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockModel, intro: 'A short pitch' }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].intro).toBe('A short pitch');
    });

    it('leaves intro undefined when not in raw payload', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockModel],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].intro).toBeUndefined();
    });

    it('sets applicationFolder for nested application deployment', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockApplication, id: 'folder1/my-app' }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationFolder).toBe('folder1');
    });

    it('sets applicationFolder for deeply nested application deployment', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockApplication, id: 'a/b/my-app' }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationFolder).toBe('a/b');
    });

    it('leaves applicationFolder absent for root-level application', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockApplication],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationFolder).toBeUndefined();
    });

    it('leaves applicationFolder absent for model deployments', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockModel, id: 'folder/gpt-4o' }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationFolder).toBeUndefined();
    });

    it('leaves applicationFolder absent for toolset deployments', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockToolset, id: 'folder/search-tool' }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationFolder).toBeUndefined();
    });

    it('maps features.mcp true for an MCP-capable application', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockApplication, features: { mcp: true } }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].features?.mcp).toBe(true);
    });

    it('omits features.mcp for an application without MCP support', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockApplication, features: { system_prompt: true } }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].features?.mcp).toBeUndefined();
    });

    it('maps features.mcp true when only a root-level mcp descriptor is present (no features.mcp)', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            mcp: { endpoint: 'https://example.com/mcp', transport: 'sse' },
          },
        ],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].features?.mcp).toBe(true);
    });

    it('maps features.mcp true from a root-level mcp descriptor even when features is otherwise absent', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            id: 'my-mcp-app',
            object: 'application',
            display_name: 'My MCP App',
            mcp: { endpoint: 'https://example.com/mcp' },
          },
        ],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].features?.mcp).toBe(true);
      expect(result.deployments[0].features?.systemPrompt).toBe(false);
    });

    it('maps features.mcp true when "mcp" is listed in interfaces with neither features.mcp nor a root mcp descriptor present', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            id: 'simple-mcp-app',
            object: 'application',
            display_name: 'Simple MCP app',
            interfaces: ['mcp', 'chat', 'openaiChatCompletions'],
            features: { system_prompt: true, temperature: true },
          },
        ],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].features?.mcp).toBe(true);
      expect(result.deployments[0].features?.systemPrompt).toBe(true);
    });

    it('sets isMy=true when bucket appears as a path segment in id', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            id: 'applications/BUCKET_HASH/my-app',
            owner: 'Valery Dluski',
          },
        ],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].isMy).toBe(true);
    });

    it('sets isMy=false when bucket does not appear in id', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            id: 'applications/OTHER_BUCKET/their-app',
            owner: 'Other User',
          },
        ],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].isMy).toBe(false);
    });

    it('sets isMy=false for root-level app whose id has no path segments matching bucket', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockApplication],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].isMy).toBe(false);
    });

    it('re-evaluates isMy after cache hit using current bucket', async () => {
      const cached: DeploymentItemDto[] = [
        {
          id: 'applications/BUCKET_HASH/my-app',
          displayName: 'My App',
          type: 'application',
          isMy: false,
        },
      ];
      const { service } = makeService({ cached });
      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].isMy).toBe(true);
    });
  });

  describe('canEdit', () => {
    it('sets canEdit=true when the deployment is owned by the user', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            id: 'applications/BUCKET_HASH/my-app',
          },
        ],
      });

      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].canEdit).toBe(true);
    });

    it('sets canEdit=true for a shared application with WRITE permission', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            id: 'applications/OTHER_BUCKET/their-app',
          },
        ],
      });
      sdkClient.getSharedResources.mockResolvedValue({
        data: {
          resources: [
            {
              url: 'applications/OTHER_BUCKET/their-app',
              permissions: ['READ', 'WRITE'],
            },
          ],
        },
        error: undefined,
      });

      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].canEdit).toBe(true);
    });

    it('sets canEdit=false for a shared application with READ-only permission', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            id: 'applications/OTHER_BUCKET/their-app',
          },
        ],
      });
      sdkClient.getSharedResources.mockResolvedValue({
        data: {
          resources: [
            {
              url: 'applications/OTHER_BUCKET/their-app',
              permissions: ['READ'],
            },
          ],
        },
        error: undefined,
      });

      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].canEdit).toBe(false);
    });

    it('sets canEdit=false when getSharedResources fails', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            id: 'applications/OTHER_BUCKET/their-app',
          },
        ],
      });
      sdkClient.getSharedResources.mockRejectedValue(new Error('boom'));

      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].canEdit).toBe(false);
    });
  });

  describe('sharedWithMe', () => {
    it('is false for an owned application, even if a share grant is also returned', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockApplication, id: 'applications/BUCKET_HASH/my-app' }],
      });
      sdkClient.getSharedResources.mockResolvedValue({
        data: {
          resources: [
            {
              url: 'applications/BUCKET_HASH/my-app',
              permissions: ['READ', 'WRITE'],
            },
          ],
        },
        error: undefined,
      });

      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].sharedWithMe).toBe(false);
    });

    it('is true for a READ-only shared application', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          { ...mockApplication, id: 'applications/OTHER_BUCKET/their-app' },
        ],
      });
      sdkClient.getSharedResources.mockResolvedValue({
        data: {
          resources: [
            {
              url: 'applications/OTHER_BUCKET/their-app',
              permissions: ['READ'],
            },
          ],
        },
        error: undefined,
      });

      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].sharedWithMe).toBe(true);
    });

    it('is true for a WRITE-shared application', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          { ...mockApplication, id: 'applications/OTHER_BUCKET/their-app' },
        ],
      });
      sdkClient.getSharedResources.mockResolvedValue({
        data: {
          resources: [
            {
              url: 'applications/OTHER_BUCKET/their-app',
              permissions: ['WRITE'],
            },
          ],
        },
        error: undefined,
      });

      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].sharedWithMe).toBe(true);
      expect(result.deployments[0].canEdit).toBe(true);
    });

    it('is false for a public/organization application not returned by getSharedResources', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          { ...mockApplication, id: 'applications/OTHER_BUCKET/their-app' },
        ],
      });
      sdkClient.getSharedResources.mockResolvedValue({
        data: { resources: [] },
        error: undefined,
      });

      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].sharedWithMe).toBe(false);
    });

    it('degrades to false when getSharedResources fails', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          { ...mockApplication, id: 'applications/OTHER_BUCKET/their-app' },
        ],
      });
      sdkClient.getSharedResources.mockRejectedValue(new Error('boom'));

      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].sharedWithMe).toBe(false);
    });

    it('logs and degrades to false when getSharedResources returns an error response', async () => {
      const { service, sdkClient } = makeService();
      const warnSpy = vi.spyOn(service['logger'], 'warn');
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          { ...mockApplication, id: 'applications/OTHER_BUCKET/their-app' },
        ],
      });
      sdkClient.getSharedResources.mockResolvedValue({
        data: undefined,
        error: {},
        response: { status: 503 },
      });

      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );

      expect(result.deployments[0].sharedWithMe).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to resolve shared application resources: status=503',
      );
    });

    it('resolves canEdit and sharedWithMe from exactly one getSharedResources call', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          { ...mockApplication, id: 'applications/OTHER_BUCKET/their-app' },
        ],
      });
      sdkClient.getSharedResources.mockResolvedValue({
        data: {
          resources: [
            {
              url: 'applications/OTHER_BUCKET/their-app',
              permissions: ['WRITE'],
            },
          ],
        },
        error: undefined,
      });

      await service.listDeployments('user1', 'token', 'BUCKET_HASH');
      expect(sdkClient.getSharedResources).toHaveBeenCalledOnce();
    });
  });

  describe('getDeploymentConfiguration', () => {
    const schema = { type: 'object', title: 'StatGPT Config', properties: {} };

    it('returns configuration schema from upstream on cache miss', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'configurationDeployment',
      ).mockResolvedValue(okResponse(schema));

      const result = await service.getDeploymentConfiguration(
        'statgpt',
        'user-123',
        'token',
      );
      expect(result).toEqual(schema);
    });

    it('forwards Authorization header to DIAL Core', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'configurationDeployment')
        .mockResolvedValue(okResponse(schema));

      await service.getDeploymentConfiguration(
        'statgpt',
        'user-123',
        'my-token',
      );
      expect(spy).toHaveBeenCalledWith(
        'statgpt',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('encodes each deployment path segment before calling DIAL Core', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'configurationDeployment')
        .mockResolvedValue(okResponse(schema));

      await service.getDeploymentConfiguration(
        'applications/bucket/My%20App#1',
        'user-123',
        'token',
      );

      expect(spy).toHaveBeenCalledWith(
        'applications/bucket/My%20App%231',
        expect.any(Object),
      );
    });

    it('returns cached value and skips upstream on cache hit', async () => {
      const { service, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(schema);
      const spy = vi.spyOn(
        service['dialClient'].client,
        'configurationDeployment',
      );

      const result = await service.getDeploymentConfiguration(
        'statgpt',
        'user-123',
        'token',
      );
      expect(result).toEqual(schema);
      expect(spy).not.toHaveBeenCalled();
    });

    it('stores result in cache with 60 s TTL on success', async () => {
      const { service, cacheManager } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'configurationDeployment',
      ).mockResolvedValue(okResponse(schema));

      await service.getDeploymentConfiguration('statgpt', 'user-123', 'token');
      expect(cacheManager.set).toHaveBeenCalledWith(
        'deployments:configuration:user-123:statgpt',
        schema,
        60 * 1000,
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'configurationDeployment',
      ).mockResolvedValue(errResponse(404));
      await expect(
        service.getDeploymentConfiguration('unknown', 'user-123', 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'configurationDeployment',
      ).mockRejectedValue(new TypeError('fetch failed'));
      await expect(
        service.getDeploymentConfiguration('statgpt', 'user-123', 'token'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'configurationDeployment',
      ).mockResolvedValue(errResponse(502));
      await expect(
        service.getDeploymentConfiguration('statgpt', 'user-123', 'token'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('getDeploymentLimits', () => {
    const mockLimits = {
      dayTokenStats: { total: 10000, used: 4000 },
      dayCostStats: { total: 100, used: 10 },
    };

    it('returns limits from upstream', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(okResponse(mockLimits));

      const result = await service.getDeploymentLimits('gpt-4o', 'token');
      expect(result).toEqual(mockLimits);
    });

    it('forwards Authorization header to DIAL Core', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(okResponse(mockLimits));

      await service.getDeploymentLimits('gpt-4o', 'my-token');
      expect(sdkClient.getDeploymentLimits).toHaveBeenCalledWith(
        'gpt-4o',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('encodes each deployment path segment before calling DIAL Core', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(okResponse(mockLimits));

      await service.getDeploymentLimits(
        'applications/bucket/My%20App#1',
        'token',
      );

      expect(sdkClient.getDeploymentLimits).toHaveBeenCalledWith(
        'applications/bucket/My%20App%231',
        expect.any(Object),
      );
    });

    it('does not use cache — two calls invoke upstream twice', async () => {
      const { service, sdkClient, cacheManager } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(okResponse(mockLimits));

      await service.getDeploymentLimits('gpt-4o', 'token');
      await service.getDeploymentLimits('gpt-4o', 'token');

      expect(sdkClient.getDeploymentLimits).toHaveBeenCalledTimes(2);
      expect(cacheManager.get).not.toHaveBeenCalledWith(
        expect.stringContaining('limits'),
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(errResponse(404));
      await expect(
        service.getDeploymentLimits('unknown', 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(
        service.getDeploymentLimits('gpt-4o', 'token'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(errResponse(502));
      await expect(
        service.getDeploymentLimits('gpt-4o', 'token'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('getDeploymentDetails', () => {
    it('encodes each deployment path segment before calling DIAL Core', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getApplication.mockResolvedValue(
        okResponse({ id: 'applications/bucket/My%20App%231' }),
      );

      await service.getDeploymentDetails(
        'user1',
        'applications/bucket/My%20App#1',
        'token',
      );

      expect(sdkClient.getApplication).toHaveBeenCalledWith(
        'applications/bucket/My%20App%231',
        expect.any(Object),
      );
    });

    it('dispatches to getModel and maps capabilities/limits/pricing for a model', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(
        okResponse({
          id: 'gpt-4o',
          capabilities: { chat_completion: true, scale_types: ['standard'] },
          lifecycle_status: 'generally-available',
          tokenizer_model: 'gpt-4o',
          limits: { max_total_tokens: 128000 },
          pricing: { unit: 'token', prompt: '0.01', completion: '0.03' },
        }),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'gpt-4o',
        'token',
      );

      expect(result).toEqual({
        id: 'gpt-4o',
        type: 'model',
        modelDetails: {
          capabilities: {
            completion: undefined,
            chatCompletion: true,
            embeddings: undefined,
            fineTune: undefined,
            inference: undefined,
            scaleTypes: ['standard'],
          },
          lifecycleStatus: 'generally-available',
          tokenizerModel: 'gpt-4o',
          limits: {
            maxTotalTokens: 128000,
            maxPromptTokens: undefined,
            maxCompletionTokens: undefined,
          },
          pricing: { unit: 'token', prompt: '0.01', completion: '0.03' },
        },
      });
      expect(sdkClient.getApplication).not.toHaveBeenCalled();
      expect(sdkClient.getToolset).not.toHaveBeenCalled();
    });

    it('dispatches to getApplication, maps owner/features/inputAttachmentTypes, and excludes function.env/source_folder/target_folder', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getApplication.mockResolvedValue(
        okResponse({
          id: 'applications/my-app',
          owner: 'Yauheniya Hladkaya',
          application_properties: { customFlag: true },
          application_type_schema_id: 'https://example.com/schemas/quickapp',
          input_attachment_types: [],
          features: { configuration: true, tools: false, mcp: false },
          function: {
            runtime: 'python3.11',
            status: 'DEPLOYED',
            env: { SECRET: 'value' },
            source_folder: 'src/',
            target_folder: 'dist/',
          },
          routes: { default: {} },
          editor_url: 'https://editor.example.com',
        }),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'applications/my-app',
        'token',
      );

      expect(result).toEqual({
        id: 'applications/my-app',
        type: 'application',
        applicationDetails: {
          applicationProperties: { customFlag: true },
          functionRuntime: 'python3.11',
          functionStatus: 'DEPLOYED',
          routes: ['default'],
          owner: 'Yauheniya Hladkaya',
          applicationTypeSchemaId: 'https://example.com/schemas/quickapp',
          inputAttachmentTypes: [],
          features: expect.objectContaining({
            hasConfigurationSchema: true,
            tools: false,
            mcp: false,
          }),
        },
      });
      expect(JSON.stringify(result)).not.toContain('SECRET');
      expect(JSON.stringify(result)).not.toContain('editor.example.com');
    });

    it('maps display_name for an application', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getApplication.mockResolvedValue(
        okResponse({
          id: 'applications/public/finhub-via-openapi__1.0.0',
          display_name: 'finhub-via-openapi',
        }),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'applications/public/finhub-via-openapi__1.0.0',
        'token',
      );

      expect(result.applicationDetails?.displayName).toBe('finhub-via-openapi');
    });

    it('logs the raw DIAL Core application response and the mapped response', async () => {
      const debugSpy = vi
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => undefined);
      const { service, sdkClient } = makeService();
      sdkClient.getApplication.mockResolvedValue(
        okResponse({
          id: 'applications/public/finhub-via-openapi__1.0.0',
          display_name: 'finhub-via-openapi',
        }),
      );

      await service.getDeploymentDetails(
        'user1',
        'applications/public/finhub-via-openapi__1.0.0',
        'token',
      );

      const logged = debugSpy.mock.calls.map((call) => String(call[0]));
      expect(
        logged.some((line) => line.includes('DIAL Core application details')),
      ).toBe(true);
      expect(logged.some((line) => line.includes('sent to frontend'))).toBe(
        true,
      );
      expect(logged.join('\n')).toContain('finhub-via-openapi');

      debugSpy.mockRestore();
    });

    it('dispatches to getToolset, maps owner/features/auth status, and forwards all non-secret authSettings fields', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getToolset.mockResolvedValue(
        okResponse({
          id: 'toolsets/search-tool',
          toolset: 'toolsets/search-tool',
          owner: 'Anastasiia Harkot',
          transport: 'HTTP',
          allowed_tools: ['search', 'fetch'],
          features: { mcp: true, tools: false, cache: false },
          auth_settings: {
            authentication_type: 'OAUTH',
            dynamically_registered: true,
            client_id: 'public-client-id',
            client_secret: 'super-secret',
            code_verifier: 'super-secret-verifier',
            code_challenge: 'challenge-value',
            code_challenge_method: 'S256',
            redirect_uri: 'https://chat.example.com/oauth/callback',
            token_endpoint_auth_method: 'client_secret_post',
            global_auth_status: 'SIGNED_OUT',
            app_level_auth_status: 'SIGNED_OUT',
            user_level_auth_status: 'SIGNED_IN',
            scopes_supported: ['read', 'write'],
            authorization_endpoint: 'https://mcp.example.com/oauth/authorize',
            token_endpoint: 'https://mcp.example.com/oauth/token',
          },
        }),
      );
      sdkClient.getToolSetTools.mockResolvedValue(
        okResponse({
          tools: [
            { name: 'search', title: 'Search' },
            { name: 'fetch', title: 'Fetch' },
            { name: 'browse', title: 'Browse' },
          ],
        }),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'toolsets/search-tool',
        'token',
      );

      expect(result).toEqual({
        id: 'toolsets/search-tool',
        type: 'toolset',
        toolsetDetails: {
          transport: 'HTTP',
          allowedTools: ['search', 'fetch'],
          allToolNames: ['search', 'fetch', 'browse'],
          owner: 'Anastasiia Harkot',
          features: expect.objectContaining({
            mcp: true,
            tools: false,
            cache: false,
          }),
          authSettings: {
            authenticationType: 'OAUTH',
            dynamicallyRegistered: true,
            clientId: 'public-client-id',
            codeChallenge: 'challenge-value',
            codeChallengeMethod: 'S256',
            redirectUri: 'https://chat.example.com/oauth/callback',
            tokenEndpointAuthMethod: 'client_secret_post',
            globalAuthStatus: 'SIGNED_OUT',
            appLevelAuthStatus: 'SIGNED_OUT',
            userLevelAuthStatus: 'SIGNED_IN',
            scopesSupported: ['read', 'write'],
            authorizationEndpoint: 'https://mcp.example.com/oauth/authorize',
            tokenEndpoint: 'https://mcp.example.com/oauth/token',
          },
        },
      });
      expect(JSON.stringify(result)).not.toContain('super-secret');
      expect(JSON.stringify(result)).toContain('public-client-id');
    });

    it('logs the raw DIAL Core toolset response and the mapped response, redacting client_secret/code_verifier from the raw-response log', async () => {
      const debugSpy = vi
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => undefined);
      const { service, sdkClient } = makeService();
      sdkClient.getToolset.mockResolvedValue(
        okResponse({
          id: 'toolsets/search-tool',
          toolset: 'toolsets/search-tool',
          owner: 'Anastasiia Harkot',
          transport: 'HTTP',
          auth_settings: {
            authentication_type: 'OAUTH',
            client_id: 'public-client-id',
            client_secret: 'super-secret',
            code_verifier: 'super-secret-verifier',
          },
        }),
      );
      sdkClient.getToolSetTools.mockResolvedValue(errResponse(403));

      await service.getDeploymentDetails(
        'user1',
        'toolsets/search-tool',
        'token',
      );

      const logged = debugSpy.mock.calls.map((call) => String(call[0]));
      expect(logged.some((line) => line.includes('DIAL Core toolset'))).toBe(
        true,
      );
      expect(logged.some((line) => line.includes('sent to frontend'))).toBe(
        true,
      );
      expect(logged.join('\n')).not.toContain('super-secret');
      expect(logged.join('\n')).toContain('public-client-id');

      debugSpy.mockRestore();
    });

    it('omits allToolNames without failing the request when getToolSetTools errors', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getToolset.mockResolvedValue(
        okResponse({ id: 'toolsets/search-tool', transport: 'HTTP' }),
      );
      sdkClient.getToolSetTools.mockResolvedValue(errResponse(403));

      const result = await service.getDeploymentDetails(
        'user1',
        'toolsets/search-tool',
        'token',
      );

      expect(result.toolsetDetails?.allToolNames).toBeUndefined();
    });

    it('throws NotFoundException when getModel, getApplication, and getToolset all fail to find the id', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(404));
      sdkClient.getApplication.mockResolvedValue(errResponse(404));
      sdkClient.getToolset.mockResolvedValue(errResponse(404));
      await expect(
        service.getDeploymentDetails('user1', 'unknown-id', 'token'),
      ).rejects.toThrow(NotFoundException);
      expect(sdkClient.getModel).toHaveBeenCalledOnce();
      expect(sdkClient.getApplication).toHaveBeenCalledOnce();
      expect(sdkClient.getToolset).toHaveBeenCalledOnce();
    });

    it('falls back to getApplication when an unprefixed id 404s on getModel', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(404));
      sdkClient.getApplication.mockResolvedValue(
        okResponse({ id: 'root-app', owner: 'someone' }),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'root-app',
        'token',
      );

      expect(result).toEqual({
        id: 'root-app',
        type: 'application',
        applicationDetails: expect.objectContaining({ owner: 'someone' }),
      });
      expect(sdkClient.getToolset).not.toHaveBeenCalled();
    });

    it('falls back to getToolset when an unprefixed id 404s on both getModel and getApplication', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(404));
      sdkClient.getApplication.mockResolvedValue(errResponse(404));
      sdkClient.getToolset.mockResolvedValue(
        okResponse({ id: 'OauthToolset-copy', owner: 'someone' }),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'OauthToolset-copy',
        'token',
      );

      expect(result).toEqual({
        id: 'OauthToolset-copy',
        type: 'toolset',
        toolsetDetails: expect.objectContaining({ owner: 'someone' }),
      });
    });

    it('throws NotFoundException instead of a TypeError when getModel resolves no error but no body', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(okResponse(undefined));
      sdkClient.getApplication.mockResolvedValue(errResponse(404));
      sdkClient.getToolset.mockResolvedValue(errResponse(404));

      await expect(
        service.getDeploymentDetails('user1', 'OauthToolset-copy', 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns cached value without calling the upstream detail SDK method', async () => {
      const cachedDetails = { id: 'gpt-4o', type: 'model' as const };
      const { service, sdkClient, cacheManager } = makeService();
      cacheManager.get.mockImplementation((key: string) =>
        Promise.resolve(
          key === 'deployments:details:user1:gpt-4o'
            ? cachedDetails
            : undefined,
        ),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'gpt-4o',
        'token',
      );

      expect(result).toEqual(cachedDetails);
      expect(sdkClient.getModel).not.toHaveBeenCalled();
    });

    it('stores the mapped result in cache with a 60 s TTL', async () => {
      const { service, sdkClient, cacheManager } = makeService();
      sdkClient.getModel.mockResolvedValue(okResponse({ id: 'gpt-4o' }));

      await service.getDeploymentDetails('user1', 'gpt-4o', 'token');

      expect(cacheManager.set).toHaveBeenCalledWith(
        'deployments:details:user1:gpt-4o',
        expect.objectContaining({ id: 'gpt-4o', type: 'model' }),
        60 * 1000,
      );
    });

    it('joins an in-flight request instead of firing a second upstream call for concurrent requests', async () => {
      const { service, sdkClient } = makeService();
      let resolveModel: (value: unknown) => void = () => undefined;
      sdkClient.getModel.mockReturnValue(
        new Promise((resolve) => {
          resolveModel = resolve;
        }),
      );

      const first = service.getDeploymentDetails('user1', 'gpt-4o', 'token');
      const second = service.getDeploymentDetails('user1', 'gpt-4o', 'token');

      resolveModel(okResponse({ id: 'gpt-4o' }));
      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(sdkClient.getModel).toHaveBeenCalledOnce();
      expect(firstResult).toEqual(secondResult);
    });

    it('throws BadGatewayException when the detail upstream call returns 5xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(502));
      await expect(
        service.getDeploymentDetails('user1', 'gpt-4o', 'token'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException when the detail upstream call is unreachable', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockRejectedValue(new TypeError('fetch failed'));
      await expect(
        service.getDeploymentDetails('user1', 'gpt-4o', 'token'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('resolveDeploymentItem', () => {
    it('resolves an unprefixed id via getModel and maps it to DeploymentItemDto', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(okResponse(mockModel));

      const result = await service.resolveDeploymentItem('gpt-4o', 'token');

      expect(result).toMatchObject({
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        type: 'model',
      });
      expect(sdkClient.getApplication).not.toHaveBeenCalled();
    });

    it('resolves an applications/-prefixed id via getApplication directly, skipping getModel', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getApplication.mockResolvedValue(
        okResponse({ ...mockApplication, id: undefined }),
      );

      const result = await service.resolveDeploymentItem(
        'applications/my-app',
        'token',
      );

      expect(result).toMatchObject({
        id: 'applications/my-app',
        displayName: 'My App',
        type: 'application',
      });
      expect(sdkClient.getModel).not.toHaveBeenCalled();
    });

    it('falls back to getApplication when an unprefixed id 404s on getModel', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(404));
      sdkClient.getApplication.mockResolvedValue(okResponse(mockApplication));

      const result = await service.resolveDeploymentItem('my-app', 'token');

      expect(result).toMatchObject({ id: 'my-app', type: 'application' });
    });

    it('returns null immediately for a toolsets/-prefixed id without calling DIAL Core', async () => {
      const { service, sdkClient } = makeService();

      const result = await service.resolveDeploymentItem(
        'toolsets/b/search__0.0.1',
        'token',
      );

      expect(result).toBeNull();
      expect(sdkClient.getModel).not.toHaveBeenCalled();
      expect(sdkClient.getApplication).not.toHaveBeenCalled();
    });

    it('returns null when both getModel and getApplication 404 for an unprefixed id', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(404));
      sdkClient.getApplication.mockResolvedValue(errResponse(404));

      const result = await service.resolveDeploymentItem('unknown-id', 'token');

      expect(result).toBeNull();
    });

    it('throws BadGatewayException on a genuine upstream 5xx rather than returning null', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(502));

      await expect(
        service.resolveDeploymentItem('gpt-4o', 'token'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
