import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ResourceIdentityTab } from '../../common/utils/resource-identity';
import { ResourceIdentityService } from '../resource-identity.service';

const makeService = () => {
  const deploymentsService = {
    listDeployments: vi.fn().mockResolvedValue({ deployments: [] }),
  };
  const toolsetsListingService = {
    listToolsets: vi.fn().mockResolvedValue({ data: [] }),
  };
  const service = new ResourceIdentityService(
    deploymentsService as never,
    toolsetsListingService as never,
  );
  return { service, deploymentsService, toolsetsListingService };
};

const base = {
  userSub: 'user1',
  accessToken: 'token',
  bucket: 'b1',
  candidate: { folder: '', name: 'search', version: '1.0.0' },
};

const ownToolset = {
  id: 'toolsets/b1/search__1.0.0',
  displayName: 'search',
  displayVersion: '1.0.0',
  isMy: true,
};

describe('ResourceIdentityService', () => {
  describe('assertUnique', () => {
    it('reads both lists fresh for the Toolsets tab', async () => {
      const { service, deploymentsService, toolsetsListingService } =
        makeService();

      await service.assertUnique({
        ...base,
        tabs: [ResourceIdentityTab.Toolsets],
      });

      expect(deploymentsService.listDeployments).toHaveBeenCalledWith(
        'user1',
        'token',
        'b1',
        undefined,
        true,
      );
      expect(toolsetsListingService.listToolsets).toHaveBeenCalledWith(
        'user1',
        'token',
        'b1',
        true,
      );
    });

    it('skips the toolsets read for the Agents tab', async () => {
      const { service, toolsetsListingService } = makeService();

      await service.assertUnique({
        ...base,
        tabs: [ResourceIdentityTab.Agents],
      });

      expect(toolsetsListingService.listToolsets).not.toHaveBeenCalled();
    });

    it('reuses lists the caller already read', async () => {
      const { service, deploymentsService, toolsetsListingService } =
        makeService();

      await service.assertUnique({
        ...base,
        tabs: [ResourceIdentityTab.Toolsets],
        deployments: [],
        toolsets: [],
      });

      expect(deploymentsService.listDeployments).not.toHaveBeenCalled();
      expect(toolsetsListingService.listToolsets).not.toHaveBeenCalled();
    });

    it('throws the coded 409 for a duplicate', async () => {
      const { service, toolsetsListingService } = makeService();
      toolsetsListingService.listToolsets.mockResolvedValue({
        data: [ownToolset],
      });

      const error = await service
        .assertUnique({ ...base, tabs: [ResourceIdentityTab.Toolsets] })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'name-taken-toolset',
      });
    });

    it('skips the entity being rewritten', async () => {
      const { service, toolsetsListingService } = makeService();
      toolsetsListingService.listToolsets.mockResolvedValue({
        data: [ownToolset],
      });

      await expect(
        service.assertUnique({
          ...base,
          tabs: [ResourceIdentityTab.Toolsets],
          selfId: ownToolset.id,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
