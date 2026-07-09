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

vi.mock('@epam/ai-dial-catalog', () => ({
  CatalogEntityType: {
    Model: 'MODEL',
    Application: 'APPLICATION',
    Agent: 'AGENT',
    Toolset: 'TOOLSET',
  },
  Catalog: ({
    createOptions,
    items,
    favorites,
    onToggleFavorite,
    onUseInChat,
    hideCreateButton,
    hidePageTitle,
    selectedItemId,
    onCardClick,
  }: {
    createOptions?: CreateOption[];
    items?: CatalogItem[];
    favorites?: CatalogItem[];
    onToggleFavorite?: (id: string, isFavorite: boolean) => void;
    onUseInChat?: (item: CatalogItem) => void;
    hideCreateButton?: boolean;
    hidePageTitle?: boolean;
    selectedItemId?: string;
    onCardClick?: (item: CatalogItem) => void;
  }) => (
    <div>
      <output aria-label="Catalog item ids">
        {(items ?? []).map((item) => `${item.id}:${item.type}`).join(',')}
      </output>
      <output aria-label="Favorite item ids">
        {(favorites ?? []).map((item) => `${item.id}:${item.type}`).join(',')}
      </output>
      <output aria-label="hideCreateButton">
        {String(!!hideCreateButton)}
      </output>
      <output aria-label="hidePageTitle">{String(!!hidePageTitle)}</output>
      <output aria-label="selectedItemId">{selectedItemId ?? ''}</output>
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
      {(items ?? []).map((item) => (
        <button
          key={`card-click-${item.id}`}
          type="button"
          onClick={() => onCardClick?.(item)}
        >
          card click {item.id}
        </button>
      ))}
      {(createOptions ?? []).map((option) => (
        <button key={option.label} type="button" onClick={option.onClick}>
          {option.label}
        </button>
      ))}
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
      refetchToolsets: vi.fn(),
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

  it('adds toolsets from deployments context to catalog items', () => {
    vi.mocked(useDeployments).mockReturnValue({
      items: [
        {
          id: 'gpt-4o',
          displayName: 'GPT-4o',
          type: 'model',
        },
      ],
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [
        {
          id: 'toolsets/b/search__0.0.1',
          toolset: 'toolsets/b/search__0.0.1',
          displayName: 'Search',
        },
      ],
      refetchToolsets: vi.fn(),
    });

    render(<CatalogView />);

    expect(screen.getByLabelText('Catalog item ids').textContent).toBe(
      'gpt-4o:MODEL,toolsets/b/search__0.0.1:TOOLSET',
    );
  });

  it('toggles toolset favorites through the toolset user-config section', async () => {
    const toggleFavorite = vi.fn();
    vi.mocked(useDeployments).mockReturnValue({
      items: [],
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [
        {
          id: 'toolsets/b/search__0.0.1',
          toolset: 'toolsets/b/search__0.0.1',
          displayName: 'Search',
        },
      ],
      refetchToolsets: vi.fn(),
    });
    vi.mocked(useFavoriteApplications).mockReturnValue({
      favoriteIds: new Set(),
      isLoading: false,
      toggleFavorite,
    });

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', {
        name: 'favorite toolsets/b/search__0.0.1',
      }),
    );

    expect(toggleFavorite).toHaveBeenCalledWith(
      'toolsets/b/search__0.0.1',
      true,
      FavoriteEntityType.Toolset,
    );
  });

  it('selects the model as the deployment and navigates to the root route when Use in chat is clicked', async () => {
    const setSelectedItemId = vi.fn();
    vi.mocked(useDeployments).mockReturnValue({
      items: [
        {
          id: 'gpt-4o',
          displayName: 'GPT-4o',
          type: 'model',
        },
      ],
      selectedItemId: null,
      setSelectedItemId,
      restoreSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
    });

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', { name: 'use in chat gpt-4o' }),
    );

    expect(setSelectedItemId).toHaveBeenCalledWith('gpt-4o');
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Root);
  });

  it('selects the application as the deployment and navigates to the root route when Use in chat is clicked', async () => {
    const setSelectedItemId = vi.fn();
    vi.mocked(useDeployments).mockReturnValue({
      items: [
        {
          id: 'my-app',
          displayName: 'My App',
          type: 'application',
        },
      ],
      selectedItemId: null,
      setSelectedItemId,
      restoreSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
    });

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', { name: 'use in chat my-app' }),
    );

    expect(setSelectedItemId).toHaveBeenCalledWith('my-app');
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Root);
  });

  it('updates the selection when Use in chat is clicked on a different deployment', async () => {
    const setSelectedItemId = vi.fn();
    vi.mocked(useDeployments).mockReturnValue({
      items: [
        { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
        { id: 'gpt-4o-mini', displayName: 'GPT-4o mini', type: 'model' },
      ],
      selectedItemId: 'gpt-4o',
      setSelectedItemId,
      restoreSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
    });

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', { name: 'use in chat gpt-4o-mini' }),
    );

    expect(setSelectedItemId).toHaveBeenCalledWith('gpt-4o-mini');
  });

  describe('picker mode', () => {
    it('hides the Create button and does not highlight a selected card by default', () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
        selectedItemId: 'gpt-4o',
        setSelectedItemId: vi.fn(),
        restoreSelectedItemId: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [],
        toolsets: [],
        refetchToolsets: vi.fn(),
      });

      render(<CatalogView />);

      expect(screen.getByLabelText('hideCreateButton').textContent).toBe(
        'false',
      );
      expect(screen.getByLabelText('hidePageTitle').textContent).toBe('false');
      expect(screen.getByLabelText('selectedItemId').textContent).toBe('');
    });

    it('hides the Create button and highlights the selected card in picker mode', () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
        selectedItemId: 'gpt-4o',
        setSelectedItemId: vi.fn(),
        restoreSelectedItemId: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [],
        toolsets: [],
        refetchToolsets: vi.fn(),
      });

      render(<CatalogView isPickerMode />);

      expect(screen.getByLabelText('hideCreateButton').textContent).toBe(
        'true',
      );
      expect(screen.getByLabelText('hidePageTitle').textContent).toBe('true');
      expect(screen.getByLabelText('selectedItemId').textContent).toBe(
        'gpt-4o',
      );
    });

    it('selects the clicked card and closes the modal without navigating', async () => {
      const setSelectedItemId = vi.fn();
      const onClose = vi.fn();
      vi.mocked(useDeployments).mockReturnValue({
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
        selectedItemId: null,
        setSelectedItemId,
        restoreSelectedItemId: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [],
        toolsets: [],
        refetchToolsets: vi.fn(),
      });

      render(<CatalogView isPickerMode onClose={onClose} />);

      await user.click(
        screen.getByRole('button', { name: 'card click gpt-4o' }),
      );

      expect(setSelectedItemId).toHaveBeenCalledWith('gpt-4o');
      expect(onClose).toHaveBeenCalledOnce();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('shows only models and agents, filtering out toolsets', () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [
          { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
          { id: 'my-app', displayName: 'My App', type: 'application' },
        ],
        selectedItemId: null,
        setSelectedItemId: vi.fn(),
        restoreSelectedItemId: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [],
        toolsets: [
          {
            id: 'toolsets/b/search__0.0.1',
            toolset: 'toolsets/b/search__0.0.1',
            displayName: 'Search',
          },
        ],
        refetchToolsets: vi.fn(),
      });

      render(<CatalogView isPickerMode />);

      expect(screen.getByLabelText('Catalog item ids').textContent).toBe(
        'gpt-4o:MODEL,my-app:APPLICATION',
      );
    });

    it('shows only favorited models and agents, filtering out favorited toolsets', () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [
          { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
          { id: 'my-app', displayName: 'My App', type: 'application' },
        ],
        selectedItemId: null,
        setSelectedItemId: vi.fn(),
        restoreSelectedItemId: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [],
        toolsets: [
          {
            id: 'toolsets/b/search__0.0.1',
            toolset: 'toolsets/b/search__0.0.1',
            displayName: 'Search',
          },
        ],
        refetchToolsets: vi.fn(),
      });
      vi.mocked(useFavoriteApplications).mockReturnValue({
        favoriteIds: new Set(['gpt-4o', 'my-app', 'toolsets/b/search__0.0.1']),
        isLoading: false,
        toggleFavorite: vi.fn(),
      });

      render(<CatalogView isPickerMode />);

      expect(screen.getByLabelText('Favorite item ids').textContent).toBe(
        'gpt-4o:MODEL,my-app:APPLICATION',
      );
    });

    it('shows favorited toolsets alongside models and agents outside picker mode', () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
        selectedItemId: null,
        setSelectedItemId: vi.fn(),
        restoreSelectedItemId: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [],
        toolsets: [
          {
            id: 'toolsets/b/search__0.0.1',
            toolset: 'toolsets/b/search__0.0.1',
            displayName: 'Search',
          },
        ],
        refetchToolsets: vi.fn(),
      });
      vi.mocked(useFavoriteApplications).mockReturnValue({
        favoriteIds: new Set(['gpt-4o', 'toolsets/b/search__0.0.1']),
        isLoading: false,
        toggleFavorite: vi.fn(),
      });

      render(<CatalogView />);

      expect(screen.getByLabelText('Favorite item ids').textContent).toBe(
        'gpt-4o:MODEL,toolsets/b/search__0.0.1:TOOLSET',
      );
    });

    it('shows toolsets alongside models and agents outside picker mode', () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
        selectedItemId: null,
        setSelectedItemId: vi.fn(),
        restoreSelectedItemId: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [],
        toolsets: [
          {
            id: 'toolsets/b/search__0.0.1',
            toolset: 'toolsets/b/search__0.0.1',
            displayName: 'Search',
          },
        ],
        refetchToolsets: vi.fn(),
      });

      render(<CatalogView />);

      expect(screen.getByLabelText('Catalog item ids').textContent).toBe(
        'gpt-4o:MODEL,toolsets/b/search__0.0.1:TOOLSET',
      );
    });
  });
});
