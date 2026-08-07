import { describe, expect, it, vi } from 'vitest';
import { ToolsetsService } from '../toolsets.service';

/*
 * ToolsetsService is a pure delegation facade — its business logic now
 * lives in ToolsetsListingService, ToolsetsMutationService, and
 * ToolsetsAuthService (see
 * openspec/changes/split-deployments-toolsets-services/design.md). These
 * tests only verify each facade method forwards to the right sub-service
 * unchanged; behavior is covered by that sub-service's own spec.
 */
describe('ToolsetsService facade', () => {
  const makeService = () => {
    const listingService = {
      listToolsets: vi.fn().mockResolvedValue('listing-list'),
      getToolset: vi.fn().mockResolvedValue('listing-get'),
      resolveToolsetItem: vi.fn().mockResolvedValue('listing-resolve'),
      invalidateListCache: vi.fn().mockResolvedValue(undefined),
    };
    const mutationService = {
      createToolset: vi.fn().mockResolvedValue('mutation-create'),
      updateToolset: vi.fn().mockResolvedValue('mutation-update'),
      deleteToolset: vi.fn().mockResolvedValue(undefined),
    };
    const authService = {
      loginToolset: vi.fn().mockResolvedValue(undefined),
      logoutToolset: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ToolsetsService(
      listingService as never,
      mutationService as never,
      authService as never,
    );

    return { service, listingService, mutationService, authService };
  };

  it('delegates listToolsets to ToolsetsListingService', async () => {
    const { service, listingService } = makeService();

    const result = await service.listToolsets('sub', 'token', 'bucket');

    expect(listingService.listToolsets).toHaveBeenCalledWith(
      'sub',
      'token',
      'bucket',
    );
    expect(result).toBe('listing-list');
  });

  it('delegates getToolset to ToolsetsListingService', async () => {
    const { service, listingService } = makeService();

    const result = await service.getToolset(
      'sub',
      'token',
      'bucket',
      'toolsets/bucket/name',
    );

    expect(listingService.getToolset).toHaveBeenCalledWith(
      'sub',
      'token',
      'bucket',
      'toolsets/bucket/name',
    );
    expect(result).toBe('listing-get');
  });

  it('delegates resolveToolsetItem to ToolsetsListingService', async () => {
    const { service, listingService } = makeService();

    const result = await service.resolveToolsetItem(
      'sub',
      'token',
      'toolsets/bucket/name',
    );

    expect(listingService.resolveToolsetItem).toHaveBeenCalledWith(
      'sub',
      'token',
      'toolsets/bucket/name',
    );
    expect(result).toBe('listing-resolve');
  });

  it('delegates invalidateListCache to ToolsetsListingService', async () => {
    const { service, listingService } = makeService();

    await service.invalidateListCache('sub');

    expect(listingService.invalidateListCache).toHaveBeenCalledWith('sub');
  });

  it('delegates createToolset to ToolsetsMutationService', async () => {
    const { service, mutationService } = makeService();
    const body = { name: 'my-toolset' } as never;

    const result = await service.createToolset('sub', 'token', body);

    expect(mutationService.createToolset).toHaveBeenCalledWith(
      'sub',
      'token',
      body,
    );
    expect(result).toBe('mutation-create');
  });

  it('delegates updateToolset to ToolsetsMutationService', async () => {
    const { service, mutationService } = makeService();
    const body = { name: 'my-toolset' } as never;

    const result = await service.updateToolset(
      'sub',
      'token',
      'toolsets/bucket/name',
      body,
    );

    expect(mutationService.updateToolset).toHaveBeenCalledWith(
      'sub',
      'token',
      'toolsets/bucket/name',
      body,
    );
    expect(result).toBe('mutation-update');
  });

  it('delegates deleteToolset to ToolsetsMutationService', async () => {
    const { service, mutationService } = makeService();

    await service.deleteToolset('sub', 'token', 'toolsets/bucket/name');

    expect(mutationService.deleteToolset).toHaveBeenCalledWith(
      'sub',
      'token',
      'toolsets/bucket/name',
    );
  });

  it('delegates loginToolset to ToolsetsAuthService', async () => {
    const { service, authService } = makeService();
    const body = { credentialsLevel: 'user' } as never;

    await service.loginToolset('sub', 'token', 'toolsets/bucket/name', body);

    expect(authService.loginToolset).toHaveBeenCalledWith(
      'sub',
      'token',
      'toolsets/bucket/name',
      body,
    );
  });

  it('delegates logoutToolset to ToolsetsAuthService', async () => {
    const { service, authService } = makeService();
    const body = { credentialsLevel: 'user' } as never;

    await service.logoutToolset(
      'sub',
      'token',
      'bucket',
      'toolsets/bucket/name',
      body,
    );

    expect(authService.logoutToolset).toHaveBeenCalledWith(
      'sub',
      'token',
      'bucket',
      'toolsets/bucket/name',
      body,
    );
  });
});
