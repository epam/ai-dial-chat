import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useEditedApplication } from '../useEditedApplication';

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(),
}));

const makeDeployment = (
  overrides: Partial<DeploymentItemDto> = {},
): DeploymentItemDto =>
  ({
    id: 'applications/bucket/app__1.0.0',
    displayName: 'My app',
    ...overrides,
  }) as DeploymentItemDto;

const mockDeployments = (items: DeploymentItemDto[], isLoading: boolean) =>
  vi.mocked(useDeployments).mockReturnValue({
    items,
    isLoading,
  } as unknown as ReturnType<typeof useDeployments>);

describe('useEditedApplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no deployment and is not resolving in create mode', () => {
    mockDeployments([], true);

    const { result } = renderHook(() => useEditedApplication(''));

    expect(result.current).toEqual({
      deployment: undefined,
      isResolving: false,
    });
  });

  it('stays resolving while the list is loading and has no match yet', () => {
    mockDeployments([], true);

    const { result } = renderHook(() =>
      useEditedApplication('applications/bucket/app__1.0.0'),
    );

    expect(result.current.isResolving).toBe(true);
    expect(result.current.deployment).toBeUndefined();
  });

  it('picks up the deployment once a later list update contains it', () => {
    mockDeployments([], true);
    const { result, rerender } = renderHook(() =>
      useEditedApplication('applications/bucket/app__1.0.0'),
    );

    const deployment = makeDeployment();
    mockDeployments([deployment], false);
    rerender();

    expect(result.current.deployment).toBe(deployment);
    expect(result.current.isResolving).toBe(false);
  });

  it('keeps the first match when a refetch brings a new object for the same id', () => {
    const first = makeDeployment();
    mockDeployments([first], false);
    const { result, rerender } = renderHook(() =>
      useEditedApplication('applications/bucket/app__1.0.0'),
    );

    mockDeployments([makeDeployment({ displayName: 'Renamed' })], false);
    rerender();

    expect(result.current.deployment).toBe(first);
  });

  it('stops resolving when the list finishes loading without a match', () => {
    mockDeployments([], true);
    const { result, rerender } = renderHook(() =>
      useEditedApplication('applications/bucket/missing__1.0.0'),
    );

    mockDeployments([makeDeployment()], false);
    rerender();

    expect(result.current.isResolving).toBe(false);
    expect(result.current.deployment).toBeUndefined();
  });
});
