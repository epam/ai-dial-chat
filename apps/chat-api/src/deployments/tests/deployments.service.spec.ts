import { describe, expect, it, vi } from 'vitest';
import { DeploymentsService } from '../deployments.service';

/*
 * DeploymentsService is a pure delegation facade — its business logic now
 * lives in DeploymentsListingService, DeploymentsLookupService, and
 * DeploymentsDetailsService (see
 * openspec/changes/split-deployments-toolsets-services/design.md). These
 * tests only verify each facade method forwards to the right sub-service
 * unchanged; behavior is covered by that sub-service's own spec.
 */
describe('DeploymentsService facade', () => {
  const makeService = () => {
    const listingService = {
      listDeployments: vi.fn().mockResolvedValue('listing-list'),
      invalidateListCache: vi.fn().mockResolvedValue(undefined),
    };
    const lookupService = {
      resolveDeploymentItem: vi.fn().mockResolvedValue('lookup-resolve'),
    };
    const detailsService = {
      getDeploymentDetails: vi.fn().mockResolvedValue('details-get'),
      getDeploymentConfiguration: vi.fn().mockResolvedValue('details-config'),
      getDeploymentLimits: vi.fn().mockResolvedValue('details-limits'),
      invalidateDetailsCache: vi.fn().mockResolvedValue(undefined),
    };

    const service = new DeploymentsService(
      listingService as never,
      lookupService as never,
      detailsService as never,
    );

    return { service, listingService, lookupService, detailsService };
  };

  it('delegates listDeployments to DeploymentsListingService', async () => {
    const { service, listingService } = makeService();

    const result = await service.listDeployments(
      'user1',
      'token',
      'bucket',
      undefined,
      false,
    );

    expect(listingService.listDeployments).toHaveBeenCalledWith(
      'user1',
      'token',
      'bucket',
      undefined,
      false,
    );
    expect(result).toBe('listing-list');
  });

  it('delegates invalidateListCache to DeploymentsListingService', async () => {
    const { service, listingService } = makeService();

    await service.invalidateListCache('user1');

    expect(listingService.invalidateListCache).toHaveBeenCalledWith('user1');
  });

  it('delegates resolveDeploymentItem to DeploymentsLookupService', async () => {
    const { service, lookupService } = makeService();

    const result = await service.resolveDeploymentItem('gpt-4o', 'token');

    expect(lookupService.resolveDeploymentItem).toHaveBeenCalledWith(
      'gpt-4o',
      'token',
    );
    expect(result).toBe('lookup-resolve');
  });

  it('delegates getDeploymentDetails to DeploymentsDetailsService', async () => {
    const { service, detailsService } = makeService();

    const result = await service.getDeploymentDetails(
      'user1',
      'gpt-4o',
      'token',
    );

    expect(detailsService.getDeploymentDetails).toHaveBeenCalledWith(
      'user1',
      'gpt-4o',
      'token',
    );
    expect(result).toBe('details-get');
  });

  it('delegates getDeploymentConfiguration to DeploymentsDetailsService', async () => {
    const { service, detailsService } = makeService();

    const result = await service.getDeploymentConfiguration(
      'gpt-4o',
      'user1',
      'token',
    );

    expect(detailsService.getDeploymentConfiguration).toHaveBeenCalledWith(
      'gpt-4o',
      'user1',
      'token',
    );
    expect(result).toBe('details-config');
  });

  it('delegates getDeploymentLimits to DeploymentsDetailsService', async () => {
    const { service, detailsService } = makeService();

    const result = await service.getDeploymentLimits('gpt-4o', 'token');

    expect(detailsService.getDeploymentLimits).toHaveBeenCalledWith(
      'gpt-4o',
      'token',
    );
    expect(result).toBe('details-limits');
  });

  it('delegates invalidateDetailsCache to DeploymentsDetailsService', async () => {
    const { service, detailsService } = makeService();

    await service.invalidateDetailsCache('user1', 'gpt-4o');

    expect(detailsService.invalidateDetailsCache).toHaveBeenCalledWith(
      'user1',
      'gpt-4o',
    );
  });
});
