import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useFavoriteApplications } from '../../../context/FavoriteApplicationsContext';
import { useDeploymentSelectorFieldOverlay } from '../useDeploymentSelectorFieldOverlay';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../../context/DeploymentsContext');
vi.mock('../../../context/FavoriteApplicationsContext');
vi.mock('../../../hooks/language/useLanguage', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../hooks/language/useLanguage')
    >();
  return {
    ...actual,
    useLanguage: () => ({ language: 'en' }),
  };
});

const makeDeployment = (id: string, name: string): DeploymentItemDto =>
  ({
    id,
    displayName: name,
    type: 'model',
  }) as DeploymentItemDto;

const setSelectedItemId = vi.fn();

const mockDeployments = (items: DeploymentItemDto[]) => {
  vi.mocked(useDeployments).mockReturnValue({
    items,
    selectedItemId: null,
    setSelectedItemId,
    restoreSelectedItemId: vi.fn(),
    restoreDefaultSelection: vi.fn(),
    selectedDeploymentConfiguration: null,
    isLoading: false,
    error: null,
    schemas: [],
    toolsets: [],
    refetchToolsets: vi.fn(),
    refetchDeployments: vi.fn(),
    mergeSharedItem: vi.fn(),
  });
};

describe('useDeploymentSelectorFieldOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFavoriteApplications).mockReturnValue({
      favoriteIds: new Set(),
      isLoading: false,
      toggleFavorite: vi.fn(),
    });
  });

  it('resolves a favorited selection to its display name', () => {
    mockDeployments([makeDeployment('dep-1', 'Deployment One')]);
    vi.mocked(useFavoriteApplications).mockReturnValue({
      favoriteIds: new Set(['dep-1']),
      isLoading: false,
      toggleFavorite: vi.fn(),
    });

    const { result } = renderHook(() =>
      useDeploymentSelectorFieldOverlay('dep-1', vi.fn()),
    );

    expect(result.current.resolvedLabel).toBe('Deployment One');
  });

  it('resolves a non-favorited selection via findDeploymentByIdOrReference', () => {
    mockDeployments([makeDeployment('dep-2', 'Deployment Two')]);

    const { result } = renderHook(() =>
      useDeploymentSelectorFieldOverlay('dep-2', vi.fn()),
    );

    expect(result.current.resolvedLabel).toBe('Deployment Two');
  });

  it('falls back to the raw id when selectedId cannot be resolved', () => {
    mockDeployments([makeDeployment('dep-1', 'Deployment One')]);

    const { result } = renderHook(() =>
      useDeploymentSelectorFieldOverlay('unknown-id', vi.fn()),
    );

    expect(result.current.resolvedLabel).toBe('unknown-id');
  });

  it('returns null when nothing is selected', () => {
    mockDeployments([makeDeployment('dep-1', 'Deployment One')]);

    const { result } = renderHook(() =>
      useDeploymentSelectorFieldOverlay(null, vi.fn()),
    );

    expect(result.current.resolvedLabel).toBeNull();
  });

  it('never calls setSelectedItemId', () => {
    mockDeployments([makeDeployment('dep-1', 'Deployment One')]);

    renderHook(() => useDeploymentSelectorFieldOverlay('dep-1', vi.fn()));

    expect(setSelectedItemId).not.toHaveBeenCalled();
  });

  it('reflects the deployments context loading/error state', () => {
    vi.mocked(useDeployments).mockReturnValue({
      items: [],
      selectedItemId: null,
      setSelectedItemId,
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: true,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });

    const { result } = renderHook(() =>
      useDeploymentSelectorFieldOverlay(null, vi.fn()),
    );

    expect(result.current.isLoading).toBe(true);
  });
});
