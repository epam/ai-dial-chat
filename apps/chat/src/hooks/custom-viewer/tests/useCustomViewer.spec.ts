import type {
  ApplicationSchemaSummaryDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as DeploymentsContextModule from '../../../context/DeploymentsContext';
import { useCustomViewer } from '../useCustomViewer';

vi.mock('../../../context/DeploymentsContext');

const viewerApp = {
  id: 'applications/bucket/explorer',
  reference: 'explorer-ref',
  displayName: 'Explorer',
  type: 'application',
  viewerUrl: 'https://viewer.example.com/',
} as DeploymentItemDto;

describe('useCustomViewer', () => {
  const mockUseDeployments = vi.mocked(DeploymentsContextModule.useDeployments);

  const renderWith = (
    deploymentId: string | null,
    {
      items = [viewerApp],
      schemas = [],
      isLoading = false,
    }: {
      items?: DeploymentItemDto[];
      schemas?: ApplicationSchemaSummaryDto[];
      isLoading?: boolean;
    } = {},
  ) => {
    mockUseDeployments.mockReturnValue({
      items,
      schemas,
      isLoading,
    } as unknown as ReturnType<typeof DeploymentsContextModule.useDeployments>);
    return renderHook(() => useCustomViewer(deploymentId));
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the viewer by deployment id', () => {
    const { result } = renderWith(viewerApp.id);

    expect(result.current.viewer?.url).toBe('https://viewer.example.com/');
    expect(result.current.isResolving).toBe(false);
  });

  it('resolves the viewer by deployment reference', () => {
    const { result } = renderWith('explorer-ref');

    expect(result.current.viewer?.applicationId).toBe(viewerApp.id);
  });

  it('returns no viewer for an unknown id', () => {
    const { result } = renderWith('unknown');

    expect(result.current.viewer).toBeUndefined();
  });

  it('reports resolving while deployments are loading', () => {
    const { result } = renderWith(viewerApp.id, { items: [], isLoading: true });

    expect(result.current.viewer).toBeUndefined();
    expect(result.current.isResolving).toBe(true);
  });
});
