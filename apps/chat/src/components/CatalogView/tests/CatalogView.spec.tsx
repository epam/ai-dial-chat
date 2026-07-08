import type { CatalogItem, CreateOption } from '@epam/ai-dial-catalog';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogI18nKeys } from '../../../constants/translation-keys';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import useFavoriteApplications, {
  FavoriteEntityType,
} from '../../../hooks/useFavoriteApplications/useFavoriteApplications';
import { ROUTES } from '../../../types/routes';
import CatalogView from '../CatalogView';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@epam/ai-dial-catalog', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Catalog: ({
    createOptions,
    items,
    onToggleFavorite,
    onUseInChat,
    getFolderAccess,
  }: {
    createOptions?: CreateOption[];
    items?: CatalogItem[];
    onToggleFavorite?: (id: string, isFavorite: boolean) => void;
    onUseInChat?: (item: CatalogItem) => void;
    getFolderAccess?: (folderPath: string[]) => unknown;
  }) => (
    <div>
      <output aria-label="Catalog item ids">
        {(items ?? []).map((item) => `${item.id}:${item.type}`).join(',')}
      </output>
      {(items ?? []).map((item) => (
        <button
          key={`favorite-${item.id}`}
          type="button"
          onClick={() => onToggleFavorite?.(item.id, true)}
        >
          favorite {item.id}
        </button>
      ))}
      {(items ?? []).map((item) => (
        <button
          key={`use-in-chat-${item.id}`}
          type="button"
          onClick={() => onUseInChat?.(item)}
        >
          use in chat {item.id}
        </button>
      ))}
      {(createOptions ?? []).map((option) => (
        <button key={option.label} type="button" onClick={option.onClick}>
          {option.label}
        </button>
      ))}
      <output aria-label="Folder access for unmapped folder">
        {JSON.stringify(getFolderAccess?.(['Some', 'Unmapped', 'Folder']))}
      </output>
    </div>
  ),
}));

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: vi.fn(),
}));

vi.mock(
  '../../../hooks/useFavoriteApplications/useFavoriteApplications',
  () => ({
    FavoriteEntityType: {
      Deployment: 'deployment',
      Toolset: 'toolset',
    },
    default: vi.fn(),
  }),
);

describe('CatalogView', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeployments).mockReturnValue({
      items: [],
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
    });
    vi.mocked(useNotification).mockReturnValue({
      notifications: [],
      showNotification: vi.fn(),
      dismissNotification: vi.fn(),
    });
    vi.mocked(useFavoriteApplications).mockReturnValue({
      favoriteIds: new Set(),
      isLoading: false,
      toggleFavorite: vi.fn(),
    });
  });

  it('renders Create Toolset action even when application schemas are absent', async () => {
    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', {
        name: CatalogI18nKeys.CreateToolset,
      }),
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      `${ROUTES.ToolsetEditor}?returnUrl=%2Fcatalog`,
    );
  });

  // Catalog items currently come from MOCK_CATALOG_ITEMS (see CatalogView's
  // temporary mock-data wiring) rather than the deployments/toolsets context.
  it('renders items from the mock catalog data', () => {
    render(<CatalogView />);

    expect(screen.getByLabelText('Catalog item ids').textContent).toContain(
      'gpt-4o:MODEL',
    );
  });

  it('toggles favorites for a mock catalog item', async () => {
    const toggleFavorite = vi.fn();
    vi.mocked(useFavoriteApplications).mockReturnValue({
      favoriteIds: new Set(),
      isLoading: false,
      toggleFavorite,
    });

    render(<CatalogView />);

    await user.click(screen.getByRole('button', { name: 'favorite gpt-4o' }));

    expect(toggleFavorite).toHaveBeenCalledWith(
      'gpt-4o',
      true,
      FavoriteEntityType.Deployment,
    );
  });

  it('selects the item and navigates to the root route when Use in chat is clicked', async () => {
    const setSelectedItemId = vi.fn();
    vi.mocked(useDeployments).mockReturnValue({
      items: [],
      selectedItemId: null,
      setSelectedItemId,
      restoreSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
    });

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', { name: 'use in chat gpt-4o' }),
    );

    expect(setSelectedItemId).toHaveBeenCalledWith('gpt-4o');
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Root);
  });

  it('resolves folder access for a folder with no mock data instead of throwing', () => {
    render(<CatalogView />);

    const result = JSON.parse(
      screen.getByLabelText('Folder access for unmapped folder').textContent ??
        '',
    );
    expect(result.groups).toEqual([]);
    expect(result.people).toEqual([
      { id: 'you', name: 'Yuliia M.', role: 'owner' },
    ]);
  });
});
