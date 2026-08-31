import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeploymentSelectorOverlay } from '../useDeploymentSelectorOverlay';

const mocks = vi.hoisted(() => ({
  defaultDeploymentId: 'default-model',
  isDefaultDeploymentPinned: true,
  favoriteIds: new Set<string>(),
  items: [] as DeploymentItemDto[],
  selectedItemId: 'conversation-model' as string | null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({
    config: { defaultDeploymentId: mocks.defaultDeploymentId },
  }),
  useFeatureFlag: () => mocks.isDefaultDeploymentPinned,
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({
    items: mocks.items,
    selectedItemId: mocks.selectedItemId,
    setSelectedItemId: vi.fn(),
  }),
}));
vi.mock('../../../context/FavoriteApplicationsContext', () => ({
  useFavoriteApplications: () => ({
    favoriteIds: mocks.favoriteIds,
    toggleFavorite: vi.fn(),
  }),
}));
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
vi.mock('../DeploymentSelectorOverlay', () => ({
  default: ({ pinnedItem }: { pinnedItem?: { id: string } }) => (
    <div data-testid="pinned-item">{pinnedItem?.id}</div>
  ),
}));
vi.mock('../CatalogModal', () => ({ default: () => null }));

const makeDeployment = (id: string): DeploymentItemDto =>
  ({ id, displayName: id, type: 'model' }) as DeploymentItemDto;

describe('useDeploymentSelectorOverlay', () => {
  beforeEach(() => {
    mocks.defaultDeploymentId = 'default-model';
    mocks.isDefaultDeploymentPinned = true;
    mocks.favoriteIds = new Set();
    mocks.items = [
      makeDeployment('default-model'),
      makeDeployment('conversation-model'),
    ];
    mocks.selectedItemId = 'conversation-model';
  });

  it('passes the operator default to the quick selector when another conversation model is selected', async () => {
    const { result } = renderHook(() => useDeploymentSelectorOverlay());

    render(result.current.renderOverlay(vi.fn()));

    expect((await screen.findByTestId('pinned-item')).textContent).toBe(
      'default-model',
    );
  });

  it('does not pin the operator default when the feature is disabled', async () => {
    mocks.isDefaultDeploymentPinned = false;
    const { result } = renderHook(() => useDeploymentSelectorOverlay());

    render(result.current.renderOverlay(vi.fn()));

    expect((await screen.findByTestId('pinned-item')).textContent).toBe('');
  });
});
