import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useAppConfig as mockUseAppConfig,
  useFeatureFlag as mockUseFeatureFlag,
} from '../../../context/tests/app-config-context-mock';
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
vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);
mockUseAppConfig.mockImplementation(() => ({
  config: { defaultDeploymentId: mocks.defaultDeploymentId },
}));
mockUseFeatureFlag.mockImplementation(() => mocks.isDefaultDeploymentPinned);
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
vi.mock('../../../hooks/useUiFeature', () => ({
  useUiFeature: () => true,
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
  default: ({
    pinnedItem,
    searchQuery,
    onSearchQueryChange,
  }: {
    pinnedItem?: { id: string };
    searchQuery?: string;
    onSearchQueryChange: (value: string) => void;
  }) => (
    <>
      <div data-testid="pinned-item">{pinnedItem?.id}</div>
      <input
        aria-label="Model search"
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
      />
    </>
  ),
}));
vi.mock('../CatalogModal', () => ({ default: () => null }));

const makeDeployment = (id: string): DeploymentItemDto =>
  ({ id, displayName: id, type: 'model' }) as DeploymentItemDto;

describe('useDeploymentSelectorOverlay', () => {
  it('retains search across overlay remounts and clears it on dismissal', async () => {
    const user = userEvent.setup();
    function Harness({ generation }: { generation: number }) {
      const picker = useDeploymentSelectorOverlay();
      return (
        <>
          <button onClick={() => picker.onOpenChange(false)}>
            Dismiss picker
          </button>
          <div key={generation}>{picker.renderOverlay(vi.fn())}</div>
        </>
      );
    }
    const { rerender } = render(<Harness generation={0} />);
    await user.type(
      await screen.findByRole('textbox', { name: 'Model search' }),
      'model',
    );
    rerender(<Harness generation={1} />);
    expect(
      (
        (await screen.findByRole('textbox', {
          name: 'Model search',
        })) as HTMLInputElement
      ).value,
    ).toBe('model');
    await user.click(screen.getByRole('button', { name: 'Dismiss picker' }));
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Model search',
        }) as HTMLInputElement
      ).value,
    ).toBe('');
  });
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
