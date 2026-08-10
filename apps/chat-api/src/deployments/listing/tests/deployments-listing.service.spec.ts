import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import type { DeploymentItemDto } from '../../dto/deployment-item.dto';
import { DeploymentInterfaceType } from '../../dto/deployments-query.dto';
import { DeploymentsListingService } from '../deployments-listing.service';

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
    getCustomApplication: vi.fn().mockResolvedValue({
      error: true,
      response: { status: 404 },
      data: null,
    }),
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

  const service = new DeploymentsListingService(
    dialClient,
    configService,
    cacheManager as never,
    userConfigService as never,
  );

  return { service, sdkClient, cacheManager, userConfigService };
}

describe('DeploymentsListingService', () => {
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

    it('maps reference from DIAL Core', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockModel, reference: 'ref-gpt-4o' }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].reference).toBe('ref-gpt-4o');
    });

    it('leaves reference undefined when source field is absent', async () => {
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
      expect(result.deployments[0].reference).toBeUndefined();
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
            owner: 'Test User',
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

    it('sets isMy=false when the bucket hash only matches the app-name segment, not the bucket segment', async () => {
      /*
       * Regression: an app at applications/OTHER_BUCKET/BUCKET_HASH must not
       * be misclassified as owned by BUCKET_HASH just because that value
       * happens to appear as the app-name segment rather than the bucket
       * segment (path index 1).
       */
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            id: 'applications/OTHER_BUCKET/BUCKET_HASH',
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
        'Failed to resolve shared APPLICATION resources: status=503',
      );
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to resolve shared TOOL_SET resources: status=503',
      );
    });

    it('resolves canEdit and sharedWithMe from exactly one getSharedResources call per resource type', async () => {
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
      /*
       * One call for APPLICATION-scoped shared resources, one for
       * TOOL_SET-scoped — getSharedResources is scoped to a single
       * resourceTypes filter per call, and the combined list mixes both
       * item types.
       */
      expect(sdkClient.getSharedResources).toHaveBeenCalledTimes(2);
      expect(sdkClient.getSharedResources).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ resourceTypes: ['APPLICATION'] }),
        }),
      );
      expect(sdkClient.getSharedResources).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ resourceTypes: ['TOOL_SET'] }),
        }),
      );
    });

    it('is true for a READ-only shared toolset in the combined list, using TOOL_SET-scoped resources', async () => {
      /*
       * Regression: a toolset id can never appear in the APPLICATION-scoped
       * shared-resource set, so this only passes if listDeployments fetches
       * (and uses) a separate TOOL_SET-scoped set for toolset items.
       */
      const { service, sdkClient } = makeService();
      sdkClient.listDeployments.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockToolset, id: 'toolsets/OTHER_BUCKET/their-toolset' }],
      });
      sdkClient.getSharedResources.mockImplementation(
        (opts: { body: { resourceTypes: string[] } }) =>
          Promise.resolve({
            data: {
              resources:
                opts.body.resourceTypes[0] === 'TOOL_SET'
                  ? [
                      {
                        url: 'toolsets/OTHER_BUCKET/their-toolset',
                        permissions: ['READ'],
                      },
                    ]
                  : [],
            },
            error: undefined,
          }),
      );

      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );

      expect(result.deployments[0]).toMatchObject({
        isMy: false,
        sharedWithMe: true,
        canEdit: false,
      });
    });
  });
});
