import type {
  DeploymentItemDto,
  DialToolsetDto,
  ResourceDependencyDto,
} from '@epam/ai-dial-chat-api-client';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeployments } from '../../../context/DeploymentsContext';
import { usePublishDependencyIconResolver } from '../usePublishDependencyIconResolver';

vi.mock('../../../context/DeploymentsContext');
vi.mock('../../../utils/icon-path', () => ({
  resolveCatalogIconUrl: (iconUrl?: string) =>
    iconUrl == null ? undefined : `/resolved/${iconUrl}`,
}));

const dependency = (
  id: string,
  type: ResourceDependencyDto['type'],
): ResourceDependencyDto => ({ id, name: 'x', type, location: '' });

describe('usePublishDependencyIconResolver', () => {
  beforeEach(() => {
    vi.mocked(useDeployments).mockReturnValue({
      items: [
        { id: 'applications/b/Agent__1.0.0', iconUrl: 'agent.png' },
      ] as DeploymentItemDto[],
      toolsets: [
        { id: 'toolsets/b/Search__1.0.0', iconUrl: 'search.png' },
      ] as DialToolsetDto[],
    } as ReturnType<typeof useDeployments>);
  });

  it('resolves an application icon from the loaded deployments', () => {
    const { result } = renderHook(() => usePublishDependencyIconResolver());

    expect(
      result.current(dependency('applications/b/Agent__1.0.0', 'application')),
    ).toBe('/resolved/agent.png');
  });

  it('resolves a toolset icon from the loaded toolsets', () => {
    const { result } = renderHook(() => usePublishDependencyIconResolver());

    expect(
      result.current(dependency('toolsets/b/Search__1.0.0', 'toolset')),
    ).toBe('/resolved/search.png');
  });

  it('gives no icon to an entity the catalog has not loaded', () => {
    const { result } = renderHook(() => usePublishDependencyIconResolver());

    expect(
      result.current(dependency('applications/b/Other__1.0.0', 'application')),
    ).toBeUndefined();
  });

  it('keeps the same function between renders while the lists are unchanged', () => {
    const { result, rerender } = renderHook(() =>
      usePublishDependencyIconResolver(),
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
