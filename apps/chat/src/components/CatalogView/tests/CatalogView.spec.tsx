import type { CatalogItem, CreateOption } from '@epam/ai-dial-catalog';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogI18nKeys } from '../../../constants/translation-keys';
import { useUser } from '../../../context/auth/UserContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import useFavoriteApplications, {
  FavoriteEntityType,
} from '../../../hooks/useFavoriteApplications/useFavoriteApplications';
import { getDeploymentDetails } from '../../../server-api/deployments';
import { loginToolset, logoutToolset } from '../../../server-api/toolsets';
import { AuthStatus } from '../../../types/auth-status';
import { ROUTES } from '../../../types/routes';
import CatalogView from '../CatalogView';

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
}));

vi.mock('@epam/ai-dial-catalog', () => ({
  CatalogEntityType: {
    Model: 'MODEL',
    Application: 'APPLICATION',
    Agent: 'AGENT',
    Toolset: 'TOOLSET',
  },
  ToolsetAuthenticationType: {
    None: 'NONE',
    ApiKey: 'API_KEY',
    OAuth: 'OAUTH',
  },
  CredentialStatus: {
    SignedIn: 'SIGNED_IN',
    SignedOut: 'SIGNED_OUT',
    Failed: 'FAILED',
  },
  CredentialsLevel: {
    User: 'USER',
    Global: 'GLOBAL',
  },
  Catalog: ({
    createOptions,
    items,
    onToggleFavorite,
    onUseInChat,
    onFetchDetails,
    onLogin,
    onLogout,
    initialDetailsItemId,
  }: {
    createOptions?: CreateOption[];
    items?: CatalogItem[];
    favorites?: CatalogItem[];
    onToggleFavorite?: (id: string, isFavorite: boolean) => void;
    onUseInChat?: (item: CatalogItem) => void;
    onFetchDetails?: (item: CatalogItem) => Promise<unknown>;
    onLogin?: (
      item: CatalogItem,
      params: { level: string; apiKey?: string },
    ) => Promise<void>;
    onLogout?: (item: CatalogItem, params: { level: string }) => Promise<void>;
    initialDetailsItemId?: string;
  }) => {
    const [fetchResult, setFetchResult] = useState<string>('');

    return (
      <div>
        <output aria-label="Catalog item ids">
          {(items ?? []).map((item) => `${item.id}:${item.type}`).join(',')}
        </output>
        <output aria-label="Initial details item id">
          {initialDetailsItemId ?? ''}
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
        {(items ?? []).map((item) => (
          <button
            key={`fetch-details-${item.id}`}
            type="button"
            onClick={async () => {
              const result = await onFetchDetails?.(item);
              setFetchResult(JSON.stringify(result ?? null));
            }}
          >
            fetch details {item.id}
          </button>
        ))}
        <output aria-label="Fetch details result">{fetchResult}</output>
        {(items ?? []).map((item) => (
          <button
            key={`login-user-${item.id}`}
            type="button"
            onClick={() => onLogin?.(item, { level: 'USER', apiKey: 'k' })}
          >
            login user {item.id}
          </button>
        ))}
        {(items ?? []).map((item) => (
          <button
            key={`login-global-${item.id}`}
            type="button"
            onClick={() => onLogin?.(item, { level: 'GLOBAL', apiKey: 'k' })}
          >
            login global {item.id}
          </button>
        ))}
        {(items ?? []).map((item) => (
          <button
            key={`logout-user-${item.id}`}
            type="button"
            onClick={() => onLogout?.(item, { level: 'USER' })}
          >
            logout user {item.id}
          </button>
        ))}
        {(items ?? []).map((item) => (
          <button
            key={`logout-global-${item.id}`}
            type="button"
            onClick={() => onLogout?.(item, { level: 'GLOBAL' })}
          >
            logout global {item.id}
          </button>
        ))}
        {(createOptions ?? []).map((option) => (
          <button key={option.label} type="button" onClick={option.onClick}>
            {option.label}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock('../../../context/auth/UserContext', () => ({
  useUser: vi.fn(),
}));

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(),
}));

vi.mock('../../../server-api/deployments', () => ({
  getDeploymentDetails: vi.fn(),
}));

vi.mock('../../../server-api/toolsets', () => ({
  loginToolset: vi.fn(),
  logoutToolset: vi.fn(),
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
    mockSearchParams = new URLSearchParams();
    vi.mocked(useUser).mockReturnValue({
      status: AuthStatus.Authenticated,
      user: {
        sub: 'user-1',
        providerId: 'keycloak',
        claims: {},
        isAdmin: false,
      },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
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

  it('passes the itemId search param through as initialDetailsItemId', () => {
    mockSearchParams = new URLSearchParams({ itemId: 'gpt-4o' });

    render(<CatalogView />);

    expect(screen.getByLabelText('Initial details item id').textContent).toBe(
      'gpt-4o',
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

  it('maps a fetched model DeploymentDetailsDto into structured catalog tab data', async () => {
    vi.mocked(useDeployments).mockReturnValue({
      items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
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
    vi.mocked(getDeploymentDetails).mockResolvedValue({
      id: 'gpt-4o',
      type: 'model',
      modelDetails: {
        limits: { maxTotalTokens: 128000 },
        pricing: { unit: 'token', prompt: '0.01', completion: '0.03' },
        features: {
          tools: true,
          mcp: false,
          cache: true,
          parallelToolCalls: true,
          urlAttachments: false,
          folderAttachments: false,
          seed: false,
          systemPrompt: true,
          allowResume: true,
          reasoningEfforts: ['low', 'medium', 'high'],
        },
        owner: 'organization-owner',
        inputAttachmentTypes: ['text/*', 'image/*'],
        createdAt: 1780387921823,
      },
    });

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', { name: 'fetch details gpt-4o' }),
    );

    const result = JSON.parse(
      await screen.findByLabelText('Fetch details result').then((el) => {
        expect(el.textContent).toBeTruthy();
        return el.textContent as string;
      }),
    );
    expect(result.pricing).toEqual({
      prices: [
        { label: 'Input tokens', price: '0.01' },
        { label: 'Output tokens', price: '0.03' },
      ],
      limits: [],
    });
    expect(result.overview.sections).toEqual([
      {
        title: 'Capabilities',
        specs: [
          { label: 'Tools', value: true },
          { label: 'MCP', value: false },
          { label: 'Prompt caching', value: true },
          { label: 'Parallel tool calls', value: true },
          { label: 'URL attachments', value: false },
          { label: 'Folder attachments', value: false },
          { label: 'Seed', value: false },
          { label: 'System prompt', value: true },
          { label: 'Resume', value: true },
          { label: 'Reasoning efforts', value: 'low · medium · high' },
        ],
      },
      {
        title: 'Specification',
        specs: [
          { label: 'Hosted by', value: 'organization-owner' },
          {
            label: 'Release date',
            value: new Date(1780387921823).toLocaleDateString(),
          },
          { label: 'Context window', value: '128K tokens' },
          { label: 'Input type', value: 'text/* · image/*' },
        ],
      },
    ]);
  });

  it('maps a fetched application DeploymentDetailsDto into specification/capabilities/configuration', async () => {
    vi.mocked(useDeployments).mockReturnValue({
      items: [{ id: 'my-app', displayName: 'My App', type: 'application' }],
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
    vi.mocked(getDeploymentDetails).mockResolvedValue({
      id: 'my-app',
      type: 'application',
      applicationDetails: {
        routes: ['default', 'health'],
        owner: 'Yauheniya Hladkaya',
        inputAttachmentTypes: ['text/*'],
        features: { mcp: false, tools: false, cache: false },
      },
    });

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', { name: 'fetch details my-app' }),
    );

    const result = JSON.parse(
      (await screen.findByLabelText('Fetch details result')).textContent ?? '',
    );
    expect(result.overview.sections).toEqual([
      {
        title: 'Specification',
        specs: [
          { label: 'Hosted by', value: 'Yauheniya Hladkaya' },
          { label: 'Routes', value: 'default · health' },
        ],
      },
      {
        title: 'Capabilities',
        specs: [
          { label: 'Tools', value: false },
          { label: 'MCP', value: false },
          { label: 'Prompt caching', value: false },
        ],
      },
      {
        title: 'Configuration',
        specs: [{ label: 'Input attachments', value: 'text/*' }],
      },
    ]);
  });

  it('maps a fetched toolset DeploymentDetailsDto into authentication and permissions', async () => {
    vi.mocked(useDeployments).mockReturnValue({
      items: [
        { id: 'search-tool', displayName: 'Search Tool', type: 'toolset' },
      ],
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
    vi.mocked(getDeploymentDetails).mockResolvedValue({
      id: 'search-tool',
      type: 'toolset',
      toolsetDetails: {
        transport: 'HTTP',
        allowedTools: ['search', 'fetch'],
        allToolNames: ['search', 'fetch', 'browse'],
        owner: 'Anastasiia Harkot',
        features: { mcp: true, cache: false, systemPrompt: true },
        authSettings: {
          authenticationType: 'OAUTH',
          globalAuthStatus: 'SIGNED_OUT',
          appLevelAuthStatus: 'SIGNED_OUT',
          userLevelAuthStatus: 'SIGNED_IN',
          scopesSupported: ['read', 'write'],
          authorizationEndpoint: 'https://mcp.example.com/oauth/authorize',
          tokenEndpoint: 'https://mcp.example.com/oauth/token',
        },
      },
    });

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', { name: 'fetch details search-tool' }),
    );

    const result = JSON.parse(
      (await screen.findByLabelText('Fetch details result')).textContent ?? '',
    );
    expect(result.overview.sections).toEqual([
      {
        title: 'Specification',
        specs: [
          { label: 'Authentication', value: 'OAUTH' },
          { label: 'Allowed tools', value: 'search · fetch' },
          { label: 'All supported tools', value: 'search · fetch · browse' },
          { label: 'Hosted by', value: 'Anastasiia Harkot' },
          { label: 'OAuth scopes', value: 'read · write' },
          {
            label: 'Authorization endpoint',
            value: 'https://mcp.example.com/oauth/authorize',
          },
          {
            label: 'Token endpoint',
            value: 'https://mcp.example.com/oauth/token',
          },
        ],
      },
      {
        title: 'Capabilities',
        specs: [
          { label: 'MCP', value: true },
          { label: 'Prompt caching', value: false },
          { label: 'System prompt', value: true },
        ],
      },
    ]);
  });

  it('resolves undefined without throwing when the details fetch fails', async () => {
    vi.mocked(useDeployments).mockReturnValue({
      items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
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
    vi.mocked(getDeploymentDetails).mockRejectedValue(new Error('502'));

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', { name: 'fetch details gpt-4o' }),
    );

    expect(await screen.findByLabelText('Fetch details result')).toHaveProperty(
      'textContent',
      'null',
    );
  });

  it('calls loginToolset with credentialsLevel USER for a USER-level login and refetches toolsets', async () => {
    const refetchToolsets = vi.fn().mockResolvedValue(undefined);
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
          id: 'toolsets/public/search__0.0.1',
          toolset: 'toolsets/public/search__0.0.1',
          displayName: 'Search',
          authSettings: { authenticationType: 'API_KEY' },
        },
      ],
      refetchToolsets,
    });
    vi.mocked(loginToolset).mockResolvedValue({ success: true });

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', {
        name: 'login user toolsets/public/search__0.0.1',
      }),
    );

    expect(loginToolset).toHaveBeenCalledWith(
      'toolsets/public/search__0.0.1',
      expect.objectContaining({
        credentialsLevel: 'USER',
        apiKey: 'k',
      }),
    );
    expect(refetchToolsets).toHaveBeenCalledOnce();
  });

  it('calls loginToolset with credentialsLevel GLOBAL for a GLOBAL-level login', async () => {
    const refetchToolsets = vi.fn().mockResolvedValue(undefined);
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
          id: 'toolsets/public/search__0.0.1',
          toolset: 'toolsets/public/search__0.0.1',
          displayName: 'Search',
          authSettings: { authenticationType: 'API_KEY' },
        },
      ],
      refetchToolsets,
    });
    vi.mocked(loginToolset).mockResolvedValue({ success: true });

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', {
        name: 'login global toolsets/public/search__0.0.1',
      }),
    );

    expect(loginToolset).toHaveBeenCalledWith(
      'toolsets/public/search__0.0.1',
      expect.objectContaining({ credentialsLevel: 'GLOBAL' }),
    );
  });

  it('calls logoutToolset with the requested level and refetches toolsets', async () => {
    const refetchToolsets = vi.fn().mockResolvedValue(undefined);
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
          id: 'toolsets/public/search__0.0.1',
          toolset: 'toolsets/public/search__0.0.1',
          displayName: 'Search',
          authSettings: {
            authenticationType: 'API_KEY',
            userLevelAuthStatus: 'SIGNED_IN',
          },
        },
      ],
      refetchToolsets,
    });
    vi.mocked(logoutToolset).mockResolvedValue({ success: true });

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', {
        name: 'logout user toolsets/public/search__0.0.1',
      }),
    );

    expect(logoutToolset).toHaveBeenCalledWith(
      'toolsets/public/search__0.0.1',
      expect.objectContaining({ credentialsLevel: 'USER' }),
    );
    expect(refetchToolsets).toHaveBeenCalledOnce();
  });

  it('shows an error notification when loginToolset rejects', async () => {
    const showNotification = vi.fn();
    vi.mocked(useNotification).mockReturnValue({
      notifications: [],
      showNotification,
      dismissNotification: vi.fn(),
    });
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
          id: 'toolsets/public/search__0.0.1',
          toolset: 'toolsets/public/search__0.0.1',
          displayName: 'Search',
          authSettings: { authenticationType: 'API_KEY' },
        },
      ],
      refetchToolsets: vi.fn(),
    });
    vi.mocked(loginToolset).mockRejectedValue(new Error('network error'));

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', {
        name: 'login user toolsets/public/search__0.0.1',
      }),
    );

    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
  });
});
