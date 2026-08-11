import type { CatalogItem } from '@epam/ai-dial-catalog';
import {
  CatalogEntityType,
  CatalogSortKey,
  CredentialsBadgeState,
  CredentialsUiState,
  getCredentialsBadgeState,
  getCredentialsUiState,
} from '@epam/ai-dial-catalog';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import { DropdownItem } from '@epam/ai-dial-ui-kit';
import type { DialToolsetDto } from '@epam/ai-dial-chat-api-client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ToolsetOAuthCallbackQuery,
  ToolsetOAuthResultType,
} from '../../../constants/toolsets';
import { CatalogI18nKeys } from '../../../constants/translation-keys';
import { DEFAULT_ENABLED_UI_FEATURES } from '../../../constants/ui-features';
import { useAppConfig } from '../../../context/AppConfigContext';
import { useUser } from '../../../context/auth/UserContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import {
  FavoriteEntityType,
  useFavoriteApplications,
} from '../../../context/FavoriteApplicationsContext';
import { useNotification } from '../../../context/NotificationContext';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import { useCatalogSortFilterPreference } from '../../../hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference';
import { useUiFeature } from '../../../hooks/useUiFeature';
import { deleteApplication } from '../../../server-api/applications';
import { getDeploymentLimits } from '../../../server-api/deployment-limits';
import { getDeploymentDetails } from '../../../server-api/deployments';
import { getPublishRules } from '../../../server-api/publish-rules.api';
import { publishCatalogEntity } from '../../../server-api/publish.api';
import {
  deleteToolset,
  getToolset,
  loginToolset,
  logoutToolset,
} from '../../../server-api/toolsets';
import { AuthStatus } from '../../../types/auth-status';
import { ROUTES } from '../../../types/routes';
import { UserConfigStatus } from '../../../types/user-config-status';
import { getToolsetOAuthChannelName } from '../../../utils/toolsets';
import CatalogView from '../CatalogView';

/** Minimal fake popup `Window` — enough surface for `initiateOAuthLogin`/`waitForToolsetOAuthResult`. */
const makeFakePopup = () => {
  const store = new Map<string, string>();
  return {
    sessionStorage: {
      setItem: (key: string, value: string) => store.set(key, value),
      getItem: (key: string) => store.get(key) ?? null,
    },
    location: { href: '' },
    opener: window,
    closed: false,
    close: vi.fn(),
  };
};

const postOAuthResult = (flowId: string, message: Record<string, unknown>) => {
  const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
  channel.postMessage(message);
  channel.close();
};

const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
let mockSearchParams = new URLSearchParams();

const capturedPublishProps: {
  current: {
    onPublish?: (
      item: CatalogItem,
      folderPath: string[],
      rules: PublicationRule[],
    ) => Promise<void>;
    getPublishHistory?: (item: CatalogItem) => Promise<unknown[]>;
    isPublishVisible?: (item: CatalogItem) => boolean;
    publishExpandedPaths?: Set<string>;
    onPublishExpandedPathsChange?: (paths: Set<string>) => void;
    publishLoadingPaths?: Set<string>;
    ruleSourceOptions?: string[];
    onFetchExistingRules?: (folderPath: string[]) => Promise<PublicationRule[]>;
    isShareVisible?: (item: CatalogItem) => boolean;
    sortKey?: string;
    onSortChange?: (key: string) => void;
    filterTopics?: Set<string>;
    onFilterTopicsChange?: (topics: Set<string>) => void;
    isMyAppsActive?: boolean;
    onMyAppsActiveChange?: (isActive: boolean) => void;
  } | null;
} = { current: null };

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

vi.mock('../../../server-api/publish.api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  publishCatalogEntity: vi.fn(),
}));

vi.mock('../../../server-api/publish-rules.api', () => ({
  getPublishRules: vi.fn().mockResolvedValue([]),
  toPublishRuleDto: (rule: {
    source: string;
    function: string;
    targets: string[];
  }) => ({
    source: rule.source,
    _function: rule.function,
    targets: rule.targets,
  }),
}));

vi.mock('@epam/ai-dial-catalog', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Catalog: ({
    createOptions,
    items,
    onToggleFavorite,
    onUseInChat,
    isPrimaryActionVisible,
    onEdit,
    onDelete,
    onFetchDetails,
    onLogin,
    onLogout,
    initialDetailsItemId,
    publishFolderItems,
    publishExpandedPaths,
    onPublishExpandedPathsChange,
    publishLoadingPaths,
    onCreatePublishFolder,
    onPublish,
    getPublishHistory,
    isPublishVisible,
    ruleSourceOptions,
    onFetchExistingRules,
    isShareVisible,
    sortKey,
    onSortChange,
    filterTopics,
    onFilterTopicsChange,
    isMyAppsActive,
    onMyAppsActiveChange,
  }: {
    createOptions?: DropdownItem[];
    items?: CatalogItem[];
    favorites?: CatalogItem[];
    onToggleFavorite?: (id: string, isFavorite: boolean) => void;
    onUseInChat?: (item: CatalogItem) => void;
    isPrimaryActionVisible?: (item: CatalogItem) => boolean;
    onEdit?: (item: CatalogItem) => void;
    onDelete?: (item: CatalogItem) => Promise<void>;
    onFetchDetails?: (item: CatalogItem) => Promise<unknown>;
    onLogin?: (
      item: CatalogItem,
      params: { level: string; apiKey?: string },
    ) => Promise<void>;
    onLogout?: (item: CatalogItem, params: { level: string }) => Promise<void>;
    initialDetailsItemId?: string;
    publishFolderItems?: { path: string[]; name: string }[];
    publishExpandedPaths?: Set<string>;
    onPublishExpandedPathsChange?: (paths: Set<string>) => void;
    publishLoadingPaths?: Set<string>;
    onCreatePublishFolder?: (parentPath: string[], name: string) => void;
    onPublish?: (
      item: CatalogItem,
      folderPath: string[],
      rules: PublicationRule[],
    ) => Promise<void>;
    getPublishHistory?: (item: CatalogItem) => Promise<unknown[]>;
    isPublishVisible?: (item: CatalogItem) => boolean;
    ruleSourceOptions?: string[];
    onFetchExistingRules?: (folderPath: string[]) => Promise<PublicationRule[]>;
    isShareVisible?: (item: CatalogItem) => boolean;
    sortKey?: string;
    onSortChange?: (key: string) => void;
    filterTopics?: Set<string>;
    onFilterTopicsChange?: (topics: Set<string>) => void;
    isMyAppsActive?: boolean;
    onMyAppsActiveChange?: (isActive: boolean) => void;
  }) => {
    const [fetchResult, setFetchResult] = useState<string>('');
    capturedPublishProps.current = {
      onPublish,
      getPublishHistory,
      isPublishVisible,
      publishExpandedPaths,
      onPublishExpandedPathsChange,
      publishLoadingPaths,
      ruleSourceOptions,
      onFetchExistingRules,
      isShareVisible,
      sortKey,
      onSortChange,
      filterTopics,
      onFilterTopicsChange,
      isMyAppsActive,
      onMyAppsActiveChange,
    };

    return (
      <div>
        <output aria-label="Catalog item ids">
          {(items ?? []).map((item) => `${item.id}:${item.type}`).join(',')}
        </output>
        {(items ?? []).map((item) => (
          <output
            key={`credentials-badge-${item.id}`}
            aria-label={`credentials badge ${item.id}`}
          >
            {item.credentials != null &&
            getCredentialsBadgeState(item.credentials) ===
              CredentialsBadgeState.LoggedOut
              ? 'LOGGED OUT'
              : ''}
          </output>
        ))}
        {(items ?? []).map((item) => (
          <output
            key={`credentials-action-${item.id}`}
            aria-label={`credentials action ${item.id}`}
          >
            {item.credentials != null
              ? getCredentialsUiState(item.credentials)
              : ''}
          </output>
        ))}
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
        {(items ?? [])
          .filter((item) => isPrimaryActionVisible?.(item) ?? true)
          .map((item) => (
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
            key={`edit-${item.id}`}
            type="button"
            onClick={() => onEdit?.(item)}
          >
            edit {item.id}
          </button>
        ))}
        {(items ?? []).map((item) => (
          <button
            key={`delete-${item.id}`}
            type="button"
            onClick={async () => {
              try {
                await onDelete?.(item);
              } catch {
                // Swallowed here the same way the real DeleteButton's
                // confirmation popup catches a rejected onDelete.
              }
            }}
          >
            delete {item.id}
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
          <button
            key={option.key}
            type="button"
            onClick={(domEvent) =>
              option.onClick?.({ key: option.key, domEvent })
            }
          >
            {option.label}
          </button>
        ))}
        <output aria-label="Publish folder names">
          {(publishFolderItems ?? []).map((folder) => folder.name).join(',')}
        </output>
        <button
          type="button"
          onClick={() => onCreatePublishFolder?.(['Organization'], 'New')}
        >
          create publish folder
        </button>
      </div>
    );
  },
}));

vi.mock('../../../context/auth/UserContext', () => ({
  useUser: vi.fn(),
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: vi.fn(),
}));

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(),
}));

vi.mock('../../../server-api/deployments', () => ({
  getDeploymentDetails: vi.fn(),
}));

vi.mock('../../../server-api/deployment-limits', () => ({
  getDeploymentLimits: vi.fn(),
}));

vi.mock('../../../server-api/toolsets', () => ({
  getToolset: vi.fn(),
  loginToolset: vi.fn(),
  logoutToolset: vi.fn(),
  deleteToolset: vi.fn(),
}));

vi.mock('../../../server-api/applications', () => ({
  deleteApplication: vi.fn(),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: vi.fn(),
}));

vi.mock('../../../context/FavoriteApplicationsContext', () => ({
  FavoriteEntityType: {
    Deployment: 'deployment',
    Toolset: 'toolset',
  },
  useFavoriteApplications: vi.fn(),
}));
vi.mock('../../../hooks/useUiFeature', async () => {
  const { DEFAULT_ENABLED_UI_FEATURES } =
    await import('../../../constants/ui-features');
  return {
    useUiFeature: vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (feature: any) => DEFAULT_ENABLED_UI_FEATURES.has(feature),
    ),
  };
});

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

vi.mock('../../../hooks/publish/usePublishFolders', () => ({
  usePublishFolders: vi.fn(),
}));

vi.mock(
  '../../../hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference',
  () => ({
    useCatalogSortFilterPreference: vi.fn(),
  }),
);

describe('CatalogView', () => {
  const user = userEvent.setup({ delay: null });
  let capturedPopup: ReturnType<typeof makeFakePopup> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUiFeature).mockImplementation((feature) =>
      DEFAULT_ENABLED_UI_FEATURES.has(feature),
    );
    mockSearchParams = new URLSearchParams();
    capturedPopup = undefined;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'http://localhost', href: 'http://localhost/' },
    });
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(() => {
        capturedPopup = makeFakePopup();
        return capturedPopup;
      }),
    });
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
    vi.mocked(getDeploymentLimits).mockResolvedValue({});
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
    vi.mocked(usePublishFolders).mockReturnValue({
      folderItems: [],
      expandedPaths: new Set(),
      loadedPaths: new Set(),
      loadingPaths: new Set(),
      onExpandedPathsChange: vi.fn(),
      onCreatePublishFolder: vi.fn(),
      rememberPublishFolder: vi.fn(),
      hasPublishWriteAccess: vi.fn().mockReturnValue(true),
    });
    vi.mocked(useCatalogSortFilterPreference).mockReturnValue({
      sortKey: CatalogSortKey.RecentlyUpdated,
      setSortKey: vi.fn(),
      filterTopics: new Set(),
      setFilterTopics: vi.fn(),
      isMyAppsActive: false,
      setIsMyAppsActive: vi.fn(),
    });
    vi.mocked(useAppConfig).mockReturnValue({
      status: UserConfigStatus.Ready,
      features: {},
      config: {
        asrModelId: null,
        transcribeSizeLimitBytes: 5 * 1024 * 1024,
        defaultDeploymentId: null,
        dialCoreExternalUrl: 'https://dial.example.com',
        fileManagerTabs: ['my_files', 'shared', 'organization'],
        overlayEnabled: false,
        overlayAllowedOrigins: [],
        enabledUiFeatures: null,
        announcementHtml: null,
        footerHtmlMessage: '',
        deepResearchToolId: null,
        customVisualizers: [],
        publicationFilterSources: ['title', 'role', 'dial_roles'],
      },
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

  it('passes publish folder items from usePublishFolders through to Catalog', () => {
    vi.mocked(usePublishFolders).mockReturnValue({
      folderItems: [{ path: ['Organization'], name: 'Organization' }],
      expandedPaths: new Set(),
      loadedPaths: new Set(),
      loadingPaths: new Set(),
      onExpandedPathsChange: vi.fn(),
      onCreatePublishFolder: vi.fn(),
      rememberPublishFolder: vi.fn(),
      hasPublishWriteAccess: vi.fn().mockReturnValue(true),
    });

    render(<CatalogView />);

    expect(screen.getByLabelText('Publish folder names').textContent).toBe(
      'Organization',
    );
  });

  it('forwards onCreatePublishFolder from usePublishFolders to Catalog', async () => {
    const onCreatePublishFolder = vi.fn();
    vi.mocked(usePublishFolders).mockReturnValue({
      folderItems: [],
      expandedPaths: new Set(),
      loadedPaths: new Set(),
      loadingPaths: new Set(),
      onExpandedPathsChange: vi.fn(),
      onCreatePublishFolder,
      rememberPublishFolder: vi.fn(),
      hasPublishWriteAccess: vi.fn().mockReturnValue(true),
    });

    render(<CatalogView />);
    await user.click(
      screen.getByRole('button', { name: 'create publish folder' }),
    );

    expect(onCreatePublishFolder).toHaveBeenCalledWith(['Organization'], 'New');
  });

  it('forwards expandedPaths/onExpandedPathsChange/loadingPaths from usePublishFolders to Catalog so expanding a folder triggers a fetch', () => {
    const onExpandedPathsChange = vi.fn();
    const expandedPaths = new Set(['Organization']);
    const loadingPaths = new Set(['Organization/Data Science']);
    vi.mocked(usePublishFolders).mockReturnValue({
      folderItems: [],
      expandedPaths,
      loadedPaths: new Set(),
      loadingPaths,
      onExpandedPathsChange,
      onCreatePublishFolder: vi.fn(),
      rememberPublishFolder: vi.fn(),
      hasPublishWriteAccess: vi.fn().mockReturnValue(true),
    });

    render(<CatalogView />);

    expect(capturedPublishProps.current?.publishExpandedPaths).toBe(
      expandedPaths,
    );
    expect(capturedPublishProps.current?.publishLoadingPaths).toBe(
      loadingPaths,
    );

    capturedPublishProps.current?.onPublishExpandedPathsChange?.(
      new Set(['Organization', 'Organization/Data Science']),
    );
    expect(onExpandedPathsChange).toHaveBeenCalledWith(
      new Set(['Organization', 'Organization/Data Science']),
    );
  });

  const makeCatalogItem = (overrides?: Partial<CatalogItem>): CatalogItem => ({
    id: 'tool-abc123',
    type: CatalogEntityType.Toolset,
    name: 'My toolset',
    version: '1.2.0',
    lastUsed: 'now',
    description: '',
    folder: [],
    topics: [],
    isMyApp: true,
    ...overrides,
  });

  describe('publish wiring', () => {
    it('calls publishCatalogEntity with the mapped entityType and folderPath', async () => {
      vi.mocked(publishCatalogEntity).mockResolvedValue({
        entityId: 'tool-abc123',
        entityType: 'toolset',
        folderPath: 'Organization/Data Science',
        version: '1.2.0',
        publishedAt: '2026-07-13T10:00:00.000Z',
        publishedBy: 'user@example.com',
      });

      render(<CatalogView />);
      await capturedPublishProps.current?.onPublish?.(
        makeCatalogItem(),
        ['Organization', 'Data Science'],
        [],
      );

      expect(publishCatalogEntity).toHaveBeenCalledWith(
        'toolset',
        'tool-abc123',
        {
          folderPath: 'Organization/Data Science',
          version: '1.2.0',
          rules: [],
        },
      );
    });

    it('forwards rules added in the panel to publishCatalogEntity', async () => {
      vi.mocked(publishCatalogEntity).mockResolvedValue({
        entityId: 'tool-abc123',
        entityType: 'toolset',
        folderPath: 'Organization/Data Science',
        version: '1.2.0',
        publishedAt: '2026-07-13T10:00:00.000Z',
        publishedBy: 'user@example.com',
      });
      const rules: PublicationRule[] = [
        {
          source: 'role',
          function: 'CONTAIN' as PublicationRule['function'],
          targets: ['engineering'],
        },
      ];

      render(<CatalogView />);
      await capturedPublishProps.current?.onPublish?.(
        makeCatalogItem(),
        ['Organization', 'Data Science'],
        rules,
      );

      expect(publishCatalogEntity).toHaveBeenCalledWith(
        'toolset',
        'tool-abc123',
        {
          folderPath: 'Organization/Data Science',
          version: '1.2.0',
          rules: [
            { source: 'role', _function: 'CONTAIN', targets: ['engineering'] },
          ],
        },
      );
    });

    it('sources ruleSourceOptions from useAppConfig, not a hardcoded list', () => {
      render(<CatalogView />);

      expect(capturedPublishProps.current?.ruleSourceOptions).toEqual([
        'title',
        'role',
        'dial_roles',
      ]);
    });

    it('onFetchExistingRules forwards the joined folder path to getPublishRules', async () => {
      render(<CatalogView />);

      await capturedPublishProps.current?.onFetchExistingRules?.([
        'Organization',
        'Data Science',
      ]);

      expect(vi.mocked(getPublishRules)).toHaveBeenCalledWith(
        'Organization/Data Science',
      );
    });

    it('propagates a publish API failure (e.g. 403) to the caller', async () => {
      vi.mocked(publishCatalogEntity).mockRejectedValue(new Error('Forbidden'));

      render(<CatalogView />);

      await expect(
        capturedPublishProps.current?.onPublish?.(
          makeCatalogItem(),
          ['Organization'],
          [],
        ),
      ).rejects.toThrow('Forbidden');
    });

    it('never fetches publish history and always resolves an empty list (version history is not fetched, see GH issue #7897)', async () => {
      render(<CatalogView />);
      const history =
        await capturedPublishProps.current?.getPublishHistory?.(
          makeCatalogItem(),
        );

      expect(history).toEqual([]);
    });

    it('shows Publish only for isMyApp items of a publishable type', () => {
      render(<CatalogView />);

      expect(
        capturedPublishProps.current?.isPublishVisible?.(makeCatalogItem()),
      ).toBe(true);
      expect(
        capturedPublishProps.current?.isPublishVisible?.(
          makeCatalogItem({ isMyApp: false }),
        ),
      ).toBe(false);
    });
  });

  describe('share wiring', () => {
    it('shows Share for a toolset item when toolsets-sharing is enabled', () => {
      vi.mocked(useUiFeature).mockReturnValue(true);
      render(<CatalogView />);

      expect(
        capturedPublishProps.current?.isShareVisible?.(
          makeCatalogItem({ type: CatalogEntityType.Toolset }),
        ),
      ).toBe(true);
    });

    it('hides Share for a toolset item when toolsets-sharing is disabled', () => {
      vi.mocked(useUiFeature).mockImplementation(
        (feature) => feature !== OverlayFeature.ToolsetsSharing,
      );
      render(<CatalogView />);

      expect(
        capturedPublishProps.current?.isShareVisible?.(
          makeCatalogItem({ type: CatalogEntityType.Toolset }),
        ),
      ).toBe(false);
    });

    it('hides Share for an application item when applications-sharing is disabled, independent of toolsets-sharing', () => {
      vi.mocked(useUiFeature).mockImplementation(
        (feature) => feature !== OverlayFeature.ApplicationsSharing,
      );
      render(<CatalogView />);

      expect(
        capturedPublishProps.current?.isShareVisible?.(
          makeCatalogItem({ type: CatalogEntityType.Agent }),
        ),
      ).toBe(false);
      expect(
        capturedPublishProps.current?.isShareVisible?.(
          makeCatalogItem({ type: CatalogEntityType.Toolset }),
        ),
      ).toBe(true);
    });
  });

  it('passes the itemId search param through as initialDetailsItemId', () => {
    mockSearchParams = new URLSearchParams({ itemId: 'gpt-4o' });

    render(<CatalogView />);

    expect(screen.getByLabelText('Initial details item id').textContent).toBe(
      'gpt-4o',
    );
  });

  it('clears the itemId search param once it has been read, so it acts as a one-shot signal', () => {
    mockSearchParams = new URLSearchParams({ itemId: 'gpt-4o' });

    render(<CatalogView />);

    expect(mockSetSearchParams).toHaveBeenCalledOnce();
    const [updater, options] = mockSetSearchParams.mock.calls[0];
    expect(options).toEqual({ replace: true });
    const result = updater(mockSearchParams);
    expect(result.has('itemId')).toBe(false);
  });

  it('does not touch the URL when there is no itemId search param', () => {
    mockSearchParams = new URLSearchParams();

    render(<CatalogView />);

    expect(mockSetSearchParams).not.toHaveBeenCalled();
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
      restoreDefaultSelection: vi.fn(),
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
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
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
      restoreDefaultSelection: vi.fn(),
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
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
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

  it('navigates to the toolset editor with the toolset id when Edit is clicked', async () => {
    vi.mocked(useDeployments).mockReturnValue({
      items: [],
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [
        {
          id: 'toolsets/b/search__0.0.1',
          toolset: 'toolsets/b/search__0.0.1',
          displayName: 'Search',
          isMy: true,
        },
      ],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', {
        name: 'edit toolsets/b/search__0.0.1',
      }),
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      `${ROUTES.ToolsetEditor}?id=${encodeURIComponent('toolsets/b/search__0.0.1')}&returnUrl=%2Fcatalog`,
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

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', { name: 'use in chat my-app' }),
    );

    expect(setSelectedItemId).toHaveBeenCalledWith('my-app');
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Root);
  });

  it('does not render Use in chat for a Toolset item', () => {
    vi.mocked(useDeployments).mockReturnValue({
      items: [],
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
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
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });

    render(<CatalogView />);

    expect(
      screen.queryByRole('button', {
        name: 'use in chat toolsets/b/search__0.0.1',
      }),
    ).toBeNull();
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
    vi.mocked(getDeploymentLimits).mockResolvedValue({
      hourRequestStats: { used: 2, total: 10 },
      dayTokenStats: { used: 2500, total: 10000 },
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
    expect(result.limits).toEqual({
      rows: [
        {
          label: CatalogI18nKeys.DetailsLimitsRequestsPerHour,
          used: 2,
          total: 10,
          valueLabel: CatalogI18nKeys.DetailsLimitsValue,
          ariaLabel: CatalogI18nKeys.DetailsLimitsProgressAriaLabel,
        },
        {
          label: CatalogI18nKeys.DetailsLimitsTokensPerDay,
          used: 2500,
          total: 10000,
          valueLabel: CatalogI18nKeys.DetailsLimitsValue,
          ariaLabel: CatalogI18nKeys.DetailsLimitsProgressAriaLabel,
        },
      ],
    });
    expect(getDeploymentLimits).toHaveBeenCalledWith('gpt-4o');
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
    expect(result.api.resource.endpointUrl).toBe(
      'https://dial.example.com/v1/toolset/search-tool/mcp',
    );
    expect(result.api.snippets[0].code).toContain(
      'https://dial.example.com/v1/toolset/search-tool/mcp',
    );
  });

  it('resolves undefined without throwing when the details fetch fails', async () => {
    vi.mocked(useDeployments).mockReturnValue({
      items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
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
      restoreDefaultSelection: vi.fn(),
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
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
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
      restoreDefaultSelection: vi.fn(),
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
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
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
      restoreDefaultSelection: vi.fn(),
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
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
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
      restoreDefaultSelection: vi.fn(),
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
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
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

  describe('OAuth login', () => {
    const oauthToolset = {
      id: 'toolsets/public/oauth-tool__0.0.1',
      toolset: 'toolsets/public/oauth-tool__0.0.1',
      displayName: 'OAuth Tool',
      authSettings: {
        authenticationType: 'OAUTH' as const,
        clientId: 'client-id',
        authorizationEndpoint: 'https://auth.example.com/authorize',
      },
    };

    const renderWithOAuthToolset = (
      refetchToolsets = vi.fn(),
      getToolsets: () => DialToolsetDto[] = () => [oauthToolset],
    ) => {
      vi.mocked(useDeployments).mockImplementation(() => ({
        items: [],
        selectedItemId: null,
        setSelectedItemId: vi.fn(),
        restoreSelectedItemId: vi.fn(),
        restoreDefaultSelection: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [],
        toolsets: getToolsets(),
        refetchToolsets,
        refetchDeployments: vi.fn(),
        mergeSharedItem: vi.fn(),
      }));
      return render(<CatalogView />);
    };

    it('opens a popup and, on a success result, refetches toolsets and shows a success notification', async () => {
      let currentToolsets: DialToolsetDto[] = [
        {
          ...oauthToolset,
          authSettings: {
            ...oauthToolset.authSettings,
            userLevelAuthStatus: 'SIGNED_OUT' as const,
          },
        },
      ];
      const refetchToolsets = vi.fn(async () => {
        currentToolsets = [
          {
            ...oauthToolset,
            authSettings: {
              ...oauthToolset.authSettings,
              userLevelAuthStatus: 'SIGNED_IN' as const,
            },
          },
        ];
      });
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      const { unmount } = renderWithOAuthToolset(
        refetchToolsets,
        () => currentToolsets,
      );

      expect(
        screen.getByLabelText(`credentials badge ${oauthToolset.id}`),
      ).toHaveProperty('textContent', 'LOGGED OUT');
      expect(
        screen.getByLabelText(`credentials action ${oauthToolset.id}`),
      ).toHaveProperty('textContent', CredentialsUiState.LoginWithMyCreds);

      await user.click(
        screen.getByRole('button', {
          name: `login user ${oauthToolset.id}`,
        }),
      );

      expect(capturedPopup).toBeDefined();
      const flowId = JSON.parse(
        capturedPopup?.sessionStorage.getItem('toolset-redirect-state') ?? '{}',
      ).state;

      postOAuthResult(flowId, {
        type: ToolsetOAuthResultType.Success,
        toolsetId: oauthToolset.id,
        credentialsLevel: 'USER',
      });

      await waitFor(() => expect(refetchToolsets).toHaveBeenCalledOnce());
      unmount();
      render(<CatalogView />);
      expect(
        screen.getByLabelText(`credentials badge ${oauthToolset.id}`),
      ).toHaveProperty('textContent', '');
      expect(
        screen.getByLabelText(`credentials action ${oauthToolset.id}`),
      ).toHaveProperty('textContent', CredentialsUiState.LogOut);
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      );
    });

    it('shows the success notification on the first attempt when the channel event is missed', async () => {
      const refetchToolsets = vi.fn().mockResolvedValue(undefined);
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      renderWithOAuthToolset(refetchToolsets);

      await user.click(
        screen.getByRole('button', {
          name: `login user ${oauthToolset.id}`,
        }),
      );

      const callbackUrl = new URL(ROUTES.ToolsetSignIn, window.location.origin);
      callbackUrl.searchParams.set(
        ToolsetOAuthCallbackQuery.Result,
        ToolsetOAuthResultType.Success,
      );
      if (capturedPopup) capturedPopup.location.href = callbackUrl.toString();

      await waitFor(
        () =>
          expect(showNotification).toHaveBeenCalledWith(
            expect.objectContaining({ variant: 'success' }),
          ),
        { timeout: 2000 },
      );
      expect(refetchToolsets).toHaveBeenCalledOnce();
      expect(getToolset).not.toHaveBeenCalled();
    });

    it('shows an error notification and does not refetch when the OAuth result is a failure', async () => {
      const refetchToolsets = vi.fn().mockResolvedValue(undefined);
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      renderWithOAuthToolset(refetchToolsets);

      await user.click(
        screen.getByRole('button', {
          name: `login global ${oauthToolset.id}`,
        }),
      );

      const flowId = JSON.parse(
        capturedPopup?.sessionStorage.getItem('toolset-redirect-state') ?? '{}',
      ).state;

      postOAuthResult(flowId, {
        type: 'failure',
        reason: 'login-request-failed',
      });

      await waitFor(() =>
        expect(showNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'error' }),
        ),
      );
      expect(refetchToolsets).not.toHaveBeenCalled();
    });

    it('recovers a login that actually succeeded but was reported as Cancelled by a lost broadcast message', async () => {
      const refetchToolsets = vi.fn().mockResolvedValue(undefined);
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      vi.mocked(getToolset).mockResolvedValue({
        ...oauthToolset,
        authSettings: {
          ...oauthToolset.authSettings,
          userLevelAuthStatus: 'SIGNED_IN',
        },
      } as never);
      renderWithOAuthToolset(refetchToolsets);

      await user.click(
        screen.getByRole('button', {
          name: `login user ${oauthToolset.id}`,
        }),
      );

      if (capturedPopup) capturedPopup.closed = true;
      window.dispatchEvent(new Event('focus'));

      await waitFor(() =>
        expect(showNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'success' }),
        ),
      );
      expect(refetchToolsets).toHaveBeenCalledOnce();
    });

    it('shows a popup-blocked error notification without waiting for a result', async () => {
      vi.mocked(window.open).mockReturnValueOnce(null);
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      renderWithOAuthToolset();

      await user.click(
        screen.getByRole('button', {
          name: `login user ${oauthToolset.id}`,
        }),
      );

      await waitFor(() =>
        expect(showNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'error' }),
        ),
      );
    });
  });

  it('deletes a toolset, refetches toolsets, and shows a success notification', async () => {
    const refetchToolsets = vi.fn().mockResolvedValue(undefined);
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
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [
        {
          id: 'toolsets/b/search__0.0.1',
          toolset: 'toolsets/b/search__0.0.1',
          displayName: 'Search',
          isMy: true,
        },
      ],
      refetchToolsets,
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });
    vi.mocked(deleteToolset).mockResolvedValue(undefined);

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', { name: 'delete toolsets/b/search__0.0.1' }),
    );

    expect(deleteToolset).toHaveBeenCalledWith('toolsets/b/search__0.0.1');
    expect(refetchToolsets).toHaveBeenCalledOnce();
    expect(deleteApplication).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('deletes an application, refetches deployments, and shows a success notification', async () => {
    const refetchDeployments = vi.fn().mockResolvedValue(undefined);
    const showNotification = vi.fn();
    vi.mocked(useNotification).mockReturnValue({
      notifications: [],
      showNotification,
      dismissNotification: vi.fn(),
    });
    vi.mocked(useDeployments).mockReturnValue({
      items: [
        {
          id: 'applications/b/My App__1.0',
          displayName: 'My App',
          type: 'application',
          isMy: true,
        },
      ],
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments,
      mergeSharedItem: vi.fn(),
    });
    vi.mocked(deleteApplication).mockResolvedValue(undefined);

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', {
        name: 'delete applications/b/My App__1.0',
      }),
    );

    expect(deleteApplication).toHaveBeenCalledWith(
      'applications/b/My App__1.0',
    );
    expect(refetchDeployments).toHaveBeenCalledOnce();
    expect(deleteToolset).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('shows an error notification when deleteToolset rejects', async () => {
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
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [
        {
          id: 'toolsets/b/search__0.0.1',
          toolset: 'toolsets/b/search__0.0.1',
          displayName: 'Search',
          isMy: true,
        },
      ],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });
    vi.mocked(deleteToolset).mockRejectedValue(new Error('network error'));

    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', {
        name: 'delete toolsets/b/search__0.0.1',
      }),
    );

    expect(showNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  describe('sort/filter persistence wiring', () => {
    it('passes the persisted sortKey, filterTopics, and isMyAppsActive through to Catalog', () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
        selectedItemId: null,
        setSelectedItemId: vi.fn(),
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
      vi.mocked(useCatalogSortFilterPreference).mockReturnValue({
        sortKey: CatalogSortKey.Newest,
        setSortKey: vi.fn(),
        filterTopics: new Set(['nlp']),
        setFilterTopics: vi.fn(),
        isMyAppsActive: true,
        setIsMyAppsActive: vi.fn(),
      });

      render(<CatalogView />);

      expect(capturedPublishProps.current?.sortKey).toBe(CatalogSortKey.Newest);
      expect(capturedPublishProps.current?.isMyAppsActive).toBe(true);
    });

    it('drops a persisted topic filter that no longer exists in the current items', () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
        selectedItemId: null,
        setSelectedItemId: vi.fn(),
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
      vi.mocked(useCatalogSortFilterPreference).mockReturnValue({
        sortKey: CatalogSortKey.RecentlyUpdated,
        setSortKey: vi.fn(),
        filterTopics: new Set(['deprecated-topic']),
        setFilterTopics: vi.fn(),
        isMyAppsActive: false,
        setIsMyAppsActive: vi.fn(),
      });

      render(<CatalogView />);

      expect(capturedPublishProps.current?.filterTopics).toEqual(new Set());
    });

    it('forwards Catalog sort changes to the persistence hook setter', () => {
      const setSortKey = vi.fn();
      vi.mocked(useCatalogSortFilterPreference).mockReturnValue({
        sortKey: CatalogSortKey.RecentlyUpdated,
        setSortKey,
        filterTopics: new Set(),
        setFilterTopics: vi.fn(),
        isMyAppsActive: false,
        setIsMyAppsActive: vi.fn(),
      });

      render(<CatalogView />);
      capturedPublishProps.current?.onSortChange?.(CatalogSortKey.NameAZ);

      expect(setSortKey).toHaveBeenCalledWith(CatalogSortKey.NameAZ);
    });

    it('forwards Catalog My Apps toggle changes to the persistence hook setter', () => {
      const setIsMyAppsActive = vi.fn();
      vi.mocked(useCatalogSortFilterPreference).mockReturnValue({
        sortKey: CatalogSortKey.RecentlyUpdated,
        setSortKey: vi.fn(),
        filterTopics: new Set(),
        setFilterTopics: vi.fn(),
        isMyAppsActive: false,
        setIsMyAppsActive,
      });

      render(<CatalogView />);
      capturedPublishProps.current?.onMyAppsActiveChange?.(true);

      expect(setIsMyAppsActive).toHaveBeenCalledWith(true);
    });

    it('does not forward sort/filter/My-Apps controlled props in selector mode', () => {
      render(<CatalogView isSelectorMode onClose={vi.fn()} />);

      expect(capturedPublishProps.current?.sortKey).toBeUndefined();
      expect(capturedPublishProps.current?.onSortChange).toBeUndefined();
      expect(capturedPublishProps.current?.filterTopics).toBeUndefined();
      expect(
        capturedPublishProps.current?.onFilterTopicsChange,
      ).toBeUndefined();
      expect(capturedPublishProps.current?.isMyAppsActive).toBeUndefined();
      expect(
        capturedPublishProps.current?.onMyAppsActiveChange,
      ).toBeUndefined();
    });
  });

  describe('UI feature gates', () => {
    it('renders nothing when catalog is disabled (non-selector mode)', () => {
      vi.mocked(useUiFeature).mockImplementation(
        (feature) =>
          DEFAULT_ENABLED_UI_FEATURES.has(feature) &&
          feature !== OverlayFeature.Catalog,
      );
      const { container } = render(<CatalogView />);
      expect(container.firstChild).toBeNull();
    });

    it('still renders in selector mode when catalog is disabled', () => {
      vi.mocked(useUiFeature).mockImplementation(
        (feature) =>
          DEFAULT_ENABLED_UI_FEATURES.has(feature) &&
          feature !== OverlayFeature.Catalog,
      );
      render(<CatalogView isSelectorMode onClose={vi.fn()} />);
      expect(screen.getByLabelText('Catalog item ids')).toBeTruthy();
    });

    it('excludes toolset items and the Create Toolset option when toolsets is disabled', async () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [],
        selectedItemId: null,
        setSelectedItemId: vi.fn(),
        restoreSelectedItemId: vi.fn(),
        restoreDefaultSelection: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [],
        toolsets: [
          {
            id: 'toolsets/b/search__0.0.1',
            toolset: 'toolsets/b/search__0.0.1',
            displayName: 'Search',
            isMy: true,
          },
        ],
        refetchToolsets: vi.fn(),
        refetchDeployments: vi.fn(),
        mergeSharedItem: vi.fn(),
      });
      vi.mocked(useUiFeature).mockImplementation(
        (feature) =>
          DEFAULT_ENABLED_UI_FEATURES.has(feature) &&
          feature !== OverlayFeature.Toolsets,
      );

      render(<CatalogView />);

      expect(
        screen.getByLabelText('Catalog item ids').textContent,
      ).not.toContain('toolsets/b/search__0.0.1');
      expect(
        screen.queryByRole('button', { name: CatalogI18nKeys.CreateToolset }),
      ).toBeNull();
    });

    it('shows Create Quick App by default when a quick-app schema exists', () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [],
        selectedItemId: null,
        setSelectedItemId: vi.fn(),
        restoreSelectedItemId: vi.fn(),
        restoreDefaultSelection: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [{ id: 'foo-quickapps2', displayName: 'Quick app 2.0' }],
        toolsets: [],
        refetchToolsets: vi.fn(),
        refetchDeployments: vi.fn(),
        mergeSharedItem: vi.fn(),
      } as never);

      render(<CatalogView />);

      expect(
        screen.getByRole('button', { name: CatalogI18nKeys.CreateQuickApp }),
      ).toBeTruthy();
    });

    it('hides Create Quick App when custom-applications is disabled', () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [],
        selectedItemId: null,
        setSelectedItemId: vi.fn(),
        restoreSelectedItemId: vi.fn(),
        restoreDefaultSelection: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [{ id: 'foo-quickapps2', displayName: 'Quick app 2.0' }],
        toolsets: [],
        refetchToolsets: vi.fn(),
        refetchDeployments: vi.fn(),
        mergeSharedItem: vi.fn(),
      } as never);
      vi.mocked(useUiFeature).mockImplementation(
        (feature) =>
          DEFAULT_ENABLED_UI_FEATURES.has(feature) &&
          feature !== OverlayFeature.CustomApplications,
      );

      render(<CatalogView />);

      expect(
        screen.queryByRole('button', { name: CatalogI18nKeys.CreateQuickApp }),
      ).toBeNull();
    });

    it('hides Create Quick App when hide-custom-app-creation is enabled', () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [],
        selectedItemId: null,
        setSelectedItemId: vi.fn(),
        restoreSelectedItemId: vi.fn(),
        restoreDefaultSelection: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [{ id: 'foo-quickapps2', displayName: 'Quick app 2.0' }],
        toolsets: [],
        refetchToolsets: vi.fn(),
        refetchDeployments: vi.fn(),
        mergeSharedItem: vi.fn(),
      } as never);
      vi.mocked(useUiFeature).mockImplementation(
        (feature) =>
          DEFAULT_ENABLED_UI_FEATURES.has(feature) ||
          feature === OverlayFeature.HideCustomAppCreation,
      );

      render(<CatalogView />);

      expect(
        screen.queryByRole('button', { name: CatalogI18nKeys.CreateQuickApp }),
      ).toBeNull();
    });

    it("excludes the current user's own items when catalog-hide-my-apps is enabled", () => {
      vi.mocked(useDeployments).mockReturnValue({
        items: [],
        selectedItemId: null,
        setSelectedItemId: vi.fn(),
        restoreSelectedItemId: vi.fn(),
        restoreDefaultSelection: vi.fn(),
        selectedDeploymentConfiguration: null,
        isLoading: false,
        error: null,
        schemas: [],
        toolsets: [
          {
            id: 'toolsets/b/search__0.0.1',
            toolset: 'toolsets/b/search__0.0.1',
            displayName: 'Search',
            isMy: true,
          },
        ],
        refetchToolsets: vi.fn(),
        refetchDeployments: vi.fn(),
        mergeSharedItem: vi.fn(),
      });
      vi.mocked(useUiFeature).mockImplementation(
        (feature) =>
          DEFAULT_ENABLED_UI_FEATURES.has(feature) ||
          feature === OverlayFeature.CatalogHideMyApps,
      );

      render(<CatalogView />);

      expect(
        screen.getByLabelText('Catalog item ids').textContent,
      ).not.toContain('toolsets/b/search__0.0.1');
    });
  });
});
