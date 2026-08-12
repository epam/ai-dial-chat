import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { DeploymentsLookupService } from '../deployments-lookup.service';

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

function makeService() {
  const sdkClient = {
    getModel: vi.fn(),
    getApplication: vi.fn(),
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

  const service = new DeploymentsLookupService(dialClient, configService);

  return { service, sdkClient };
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

describe('DeploymentsLookupService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveDeploymentItem', () => {
    it('resolves an unprefixed id via getModel and maps it to DeploymentItemDto', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(okResponse(mockModel));

      const result = await service.resolveDeploymentItem(
        'gpt-4o',
        'token',
        'user1',
      );

      expect(result).toMatchObject({
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        type: 'model',
      });
      expect(sdkClient.getApplication).not.toHaveBeenCalled();
    });

    it('does not call getSharedResources for a model item, since Core never returns model resources there', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(okResponse(mockModel));

      const result = await service.resolveDeploymentItem(
        'gpt-4o',
        'token',
        'user1',
      );

      expect(sdkClient.getSharedResources).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        isMy: false,
        canEdit: false,
        sharedWithMe: false,
      });
    });

    it('resolves an applications/-prefixed id via getApplication directly, skipping getModel', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getApplication.mockResolvedValue(
        okResponse({ ...mockApplication, id: undefined }),
      );

      const result = await service.resolveDeploymentItem(
        'applications/my-app',
        'token',
        'user1',
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

      const result = await service.resolveDeploymentItem(
        'my-app',
        'token',
        'user1',
      );

      expect(result).toMatchObject({ id: 'my-app', type: 'application' });
    });

    it('returns null immediately for a toolsets/-prefixed id without calling DIAL Core', async () => {
      const { service, sdkClient } = makeService();

      const result = await service.resolveDeploymentItem(
        'toolsets/b/search__0.0.1',
        'token',
        'user1',
      );

      expect(result).toBeNull();
      expect(sdkClient.getModel).not.toHaveBeenCalled();
      expect(sdkClient.getApplication).not.toHaveBeenCalled();
    });

    it('returns null when both getModel and getApplication 404 for an unprefixed id', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(404));
      sdkClient.getApplication.mockResolvedValue(errResponse(404));

      const result = await service.resolveDeploymentItem(
        'unknown-id',
        'token',
        'user1',
      );

      expect(result).toBeNull();
    });

    it('throws BadGatewayException on a genuine upstream 5xx rather than returning null', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(502));

      await expect(
        service.resolveDeploymentItem('gpt-4o', 'token', 'user1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('sets sharedWithMe=true for a just-accepted shared application, matching listDeployments enrichment', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getApplication.mockResolvedValue(
        okResponse({
          ...mockApplication,
          id: 'applications/OTHER_BUCKET/their-app',
        }),
      );
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

      const result = await service.resolveDeploymentItem(
        'applications/OTHER_BUCKET/their-app',
        'token',
        'BUCKET_HASH',
      );

      expect(result).toMatchObject({
        isMy: false,
        canEdit: false,
        sharedWithMe: true,
      });
    });

    it("sets isMy=true and sharedWithMe=false for an application in the caller's own bucket", async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getApplication.mockResolvedValue(
        okResponse({
          ...mockApplication,
          id: 'applications/BUCKET_HASH/my-app',
        }),
      );

      const result = await service.resolveDeploymentItem(
        'applications/BUCKET_HASH/my-app',
        'token',
        'BUCKET_HASH',
      );

      expect(result).toMatchObject({
        isMy: true,
        canEdit: true,
        sharedWithMe: false,
      });
    });
  });
});
