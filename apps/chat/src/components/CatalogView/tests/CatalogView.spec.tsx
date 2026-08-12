import type { CatalogItem } from '@epam/ai-dial-catalog';
import {
  CatalogEntityType,
  CatalogSortKey,
  CredentialsBadgeState,
  CredentialsUiState,
  getCredentialsBadgeState,
  getCredentialsUiState,
} from '@epam/ai-dial-catalog';
import type { DialToolsetDto } from '@epam/ai-dial-chat-api-client';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { triggerBlobDownload } from '@epam/ai-dial-chat-shared';
import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import { DropdownItem } from '@epam/ai-dial-ui-kit';
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
import { usePrompts } from '../../../context/PromptsContext';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import { useCatalogSortFilterPreference } from '../../../hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference';
import { useUiFeature } from '../../../hooks/useUiFeature';
import { deleteApplication } from '../../../server-api/applications';
import { getDeploymentLimits } from '../../../server-api/deployment-limits';
import { getDeploymentDetails } from '../../../server-api/deployments';
import {
  deletePrompt,
  getPrompt,
  getPublicPrompt,
} from '../../../server-api/prompts.api';
import { getPublishRules } from '../../../server-api/publish-rules.api';
import { publishCatalogEntity } from '../../../server-api/publish.api';
import {
  discardSharedCatalogItem,
  revokeSharedAccess,
} from '../../../server-api/share.api';
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
    function: rule.function,
    targets: rule.targets,
  }),
}));

vi.mock('@epam/ai-dial-catalog', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Catalog: ({
    createOptions,
    items,
    favorites,
    onToggleFavorite,
    onUseInChat,
    onCardClick,
    isPrimaryActionVisible,
    onEdit,
    onDownload,
    isDownloadVisible,
    onDelete,
    onUnshare,
    isUnshareVisible,
    onRevokeShare,
    isRevokeShareVisible,
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
    onCardClick?: (item: CatalogItem) => void;
    isPrimaryActionVisible?: (item: CatalogItem) => boolean;
    onEdit?: (item: CatalogItem) => void;
    onDownload?: (item: CatalogItem) => Promise<void>;
    isDownloadVisible?: (item: CatalogItem) => boolean;
    onDelete?: (item: CatalogItem) => Promise<void>;
    onUnshare?: (item: CatalogItem) => Promise<void>;
    isUnshareVisible?: (item: CatalogItem) => boolean;
    onRevokeShare?: (item: CatalogItem) => Promise<void>;
    isRevokeShareVisible?: (item: CatalogItem) => boolean;
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
        <output aria-label="Favorite item ids">
          {(favorites ?? []).map((item) => item.id).join(',')}
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
            key={`card-select-${item.id}`}
            type="button"
            onClick={() => onCardClick?.(item)}
          >
            card select {item.id}
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
        {(items ?? [])
          .filter((item) => isDownloadVisible?.(item) ?? true)
          .map((item) => (
            <button
              key={`download-${item.id}`}
              type="button"
              onClick={() => onDownload?.(item)}
            >
              download {item.id}
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
                // Swallowed here the same way the real details panel's
                // confirmation step catches a rejected onDelete.
              }
            }}
          >
            delete {item.id}
          </button>
        ))}
        {(items ?? [])
          .filter((item) => isUnshareVisible?.(item) ?? true)
          .map((item) => (
            <button
              key={`unshare-${item.id}`}
              type="button"
              onClick={async () => {
                try {
                  await onUnshare?.(item);
                } catch {
                  // Swallowed here the same way the real DetailsPanel's
                  // confirmation popup catches a rejected onUnshare.
                }
              }}
            >
              unshare {item.id}
            </button>
          ))}
        {(items ?? [])
          .filter((item) => isRevokeShareVisible?.(item) ?? true)
          .map((item) => (
            <button
              key={`revoke-share-${item.id}`}
              type="button"
              onClick={async () => {
                try {
                  await onRevokeShare?.(item);
                } catch {
                  // Swallowed here the same way the real DetailsPanel's
                  // confirmation step catches a rejected onRevokeShare.
                }
              }}
            >
              revoke {item.id}
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

vi.mock('../../../server-api/share.api', () => ({
  discardSharedCatalogItem: vi.fn(),
  revokeSharedAccess: vi.fn(),
}));

vi.mock('../../../context/PromptsContext', () => ({
  usePrompts: vi.fn(),
}));

vi.mock('../../../server-api/prompts.api', () => ({
  getPrompt: vi.fn(),
  getPublicPrompt: vi.fn(),
  deletePrompt: vi.fn(),
}));

/* Only the download trigger is stubbed; the mappers still need the real helpers. */
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  triggerBlobDownload: vi.fn(),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: vi.fn(),
}));

vi.mock('../../../context/FavoriteApplicationsContext', () => ({
  FavoriteEntityType: {
    Deployment: 'deployment',
    Toolset: 'toolset',
    Prompt: 'prompt',
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
    vi.mocked(usePrompts).mockReturnValue({
      prompts: [],
      folders: [],
      sharedWithMe: [],
      publicPrompts: [],
      publicFolders: [],
      isLoading: false,
      error: null,
      refetchPrompts: vi.fn().mockResolvedValue(undefined),
      refetchPublicPrompts: vi.fn().mockResolvedValue(undefined),
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
        appVersion: '0.0.1',
        asrModelId: null,
        transcribeSizeLimitBytes: 5 * 1024 * 1024,
        defaultDeploymentId: null,
        dialCoreExternalUrl: 'https://dial.example.com',
        fileManagerTabs: ['my_files', 'shared', 'organization'],
        overlayEnabled: false,
        overlayAllowedOrigins: [],
        enabledUiFeatures: null,
        announcementHtml: null,
        announcementTitle: null,
        announcementDescription: null,
        announcements: [],
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
            { source: 'role', function: 'CONTAIN', targets: ['engineering'] },
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

    it('shows Share for a prompt the user owns', () => {
      render(<CatalogView />);

      expect(
        capturedPublishProps.current?.isShareVisible?.(
          makeCatalogItem({ type: CatalogEntityType.Prompt, isMyApp: true }),
        ),
      ).toBe(true);
    });

    it('hides Share for a prompt the user does not own', () => {
      render(<CatalogView />);

      expect(
        capturedPublishProps.current?.isShareVisible?.(
          makeCatalogItem({ type: CatalogEntityType.Prompt, isMyApp: false }),
        ),
      ).toBe(false);
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

  it('does not render Use in chat for an Application with no chat interface', () => {
    vi.mocked(useDeployments).mockReturnValue({
      items: [
        {
          id: 'mcp-only-app',
          displayName: 'MCP Only App',
          type: 'application',
          interfaces: ['mcp'],
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
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });

    render(<CatalogView />);

    expect(
      screen.queryByRole('button', { name: 'use in chat mcp-only-app' }),
    ).toBeNull();
  });

  it('renders Use in chat for an Application supporting both chat and mcp interfaces', () => {
    vi.mocked(useDeployments).mockReturnValue({
      items: [
        {
          id: 'chat-and-mcp-app',
          displayName: 'Chat And MCP App',
          type: 'application',
          interfaces: ['chat', 'mcp'],
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
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });

    render(<CatalogView />);

    expect(
      screen.getByRole('button', { name: 'use in chat chat-and-mcp-app' }),
    ).toBeTruthy();
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

  it('maps a fetched toolset DeploymentDetailsDto into authentication and Tools tab data', async () => {
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
    expect(result.tools).toEqual({
      tools: [{ name: 'search' }, { name: 'fetch' }],
    });
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

  describe('selector mode card pick', () => {
    it('commits the pick to DeploymentsContext when no onSelect is supplied (chat input default)', async () => {
      const setSelectedItemId = vi.fn();
      vi.mocked(useDeployments).mockReturnValue({
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
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
      const onClose = vi.fn();

      render(<CatalogView isSelectorMode onClose={onClose} />);
      await user.click(
        screen.getByRole('button', { name: 'card select gpt-4o' }),
      );

      expect(setSelectedItemId).toHaveBeenCalledWith('gpt-4o');
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('routes the pick through onSelect instead of DeploymentsContext when onSelect is supplied', async () => {
      const setSelectedItemId = vi.fn();
      vi.mocked(useDeployments).mockReturnValue({
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
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
      const onClose = vi.fn();
      const onSelect = vi.fn();

      render(
        <CatalogView isSelectorMode onClose={onClose} onSelect={onSelect} />,
      );
      await user.click(
        screen.getByRole('button', { name: 'card select gpt-4o' }),
      );

      expect(onSelect).toHaveBeenCalledWith('gpt-4o');
      expect(setSelectedItemId).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledOnce();
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

  describe('unshare', () => {
    const sharedToolset = {
      id: 'toolsets/other-bucket/search__0.0.1',
      toolset: 'toolsets/other-bucket/search__0.0.1',
      displayName: 'Search',
      isMy: false,
      sharedWithMe: true,
    };
    const sharedApplication = {
      id: 'applications/other-bucket/Their App__1.0',
      displayName: 'Their App',
      type: 'application',
      isMy: false,
      sharedWithMe: true,
    };

    const mockDeployments = (
      overrides: Partial<ReturnType<typeof useDeployments>>,
    ) =>
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
        ...overrides,
      } as ReturnType<typeof useDeployments>);

    it('removes a shared toolset, refetches toolsets (not deployments), and shows a success notification', async () => {
      const refetchToolsets = vi.fn().mockResolvedValue(undefined);
      const refetchDeployments = vi.fn().mockResolvedValue(undefined);
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      mockDeployments({
        toolsets: [sharedToolset],
        refetchToolsets,
        refetchDeployments,
      } as Partial<ReturnType<typeof useDeployments>>);
      vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });

      render(<CatalogView />);

      await user.click(
        screen.getByRole('button', { name: `unshare ${sharedToolset.id}` }),
      );

      expect(discardSharedCatalogItem).toHaveBeenCalledWith(sharedToolset.id);
      expect(refetchToolsets).toHaveBeenCalledOnce();
      expect(refetchDeployments).not.toHaveBeenCalled();
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      );
    });

    it('removes a shared application, refetches deployments (not toolsets), and shows a success notification', async () => {
      const refetchToolsets = vi.fn().mockResolvedValue(undefined);
      const refetchDeployments = vi.fn().mockResolvedValue(undefined);
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      mockDeployments({
        items: [sharedApplication],
        refetchToolsets,
        refetchDeployments,
      } as Partial<ReturnType<typeof useDeployments>>);
      vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });

      render(<CatalogView />);

      await user.click(
        screen.getByRole('button', { name: `unshare ${sharedApplication.id}` }),
      );

      expect(discardSharedCatalogItem).toHaveBeenCalledWith(
        sharedApplication.id,
      );
      expect(refetchDeployments).toHaveBeenCalledOnce();
      expect(refetchToolsets).not.toHaveBeenCalled();
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      );
    });

    it('clears the selection when removing the currently selected deployment', async () => {
      const setSelectedItemId = vi.fn();
      mockDeployments({
        items: [sharedApplication],
        selectedItemId: sharedApplication.id,
        setSelectedItemId,
        refetchDeployments: vi.fn().mockResolvedValue(undefined),
      } as Partial<ReturnType<typeof useDeployments>>);
      vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });

      render(<CatalogView />);

      await user.click(
        screen.getByRole('button', { name: `unshare ${sharedApplication.id}` }),
      );

      expect(setSelectedItemId).toHaveBeenCalledWith(null);
    });

    it('leaves the selection untouched when removing a non-selected item', async () => {
      const setSelectedItemId = vi.fn();
      mockDeployments({
        items: [
          sharedApplication,
          { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
        ],
        selectedItemId: 'gpt-4o',
        setSelectedItemId,
        refetchDeployments: vi.fn().mockResolvedValue(undefined),
      } as Partial<ReturnType<typeof useDeployments>>);
      vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });

      render(<CatalogView />);

      await user.click(
        screen.getByRole('button', { name: `unshare ${sharedApplication.id}` }),
      );

      expect(setSelectedItemId).not.toHaveBeenCalled();
    });

    it('shows an error notification and skips refetch/selection-clear when discardSharedCatalogItem rejects', async () => {
      const refetchDeployments = vi.fn().mockResolvedValue(undefined);
      const setSelectedItemId = vi.fn();
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      mockDeployments({
        items: [sharedApplication],
        selectedItemId: sharedApplication.id,
        setSelectedItemId,
        refetchDeployments,
      } as Partial<ReturnType<typeof useDeployments>>);
      vi.mocked(discardSharedCatalogItem).mockRejectedValue(
        new Error('network error'),
      );

      render(<CatalogView />);

      await user.click(
        screen.getByRole('button', { name: `unshare ${sharedApplication.id}` }),
      );

      expect(refetchDeployments).not.toHaveBeenCalled();
      expect(setSelectedItemId).not.toHaveBeenCalled();
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      );
    });

    it('preserves mutation success when the subsequent refetch rejects', async () => {
      const refetchDeployments = vi
        .fn()
        .mockRejectedValue(new Error('refresh failed'));
      const setSelectedItemId = vi.fn();
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      mockDeployments({
        items: [sharedApplication],
        selectedItemId: sharedApplication.id,
        setSelectedItemId,
        refetchDeployments,
      } as Partial<ReturnType<typeof useDeployments>>);
      vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });

      render(<CatalogView />);

      await user.click(
        screen.getByRole('button', { name: `unshare ${sharedApplication.id}` }),
      );

      expect(refetchDeployments).toHaveBeenCalledOnce();
      expect(setSelectedItemId).toHaveBeenCalledWith(null);
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      );
      expect(showNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      );
    });
  });

  describe('prompt wiring', () => {
    const personalPrompt = {
      id: 'Work/AI/summarize',
      name: 'summarize',
      description: 'Summarize a document',
      content: 'Summarize the following text:',
      folderId: 'Work/AI',
      createdAt: 1,
      updatedAt: 2,
    };

    const organisationPrompt = {
      ...personalPrompt,
      id: 'Public/translate',
      name: 'translate',
      folderId: 'Public',
    };

    /*
     * Resets before setting the implementation: an earlier test in this file
     * uses `mockReturnValue`, which takes precedence over an implementation
     * set afterwards and would otherwise leak "every feature enabled" here.
     */
    const setFeatures = (
      extra: OverlayFeature[] = [],
      disabled: OverlayFeature[] = [],
    ) => {
      vi.mocked(useUiFeature).mockReset();
      vi.mocked(useUiFeature).mockImplementation(
        (feature) =>
          !disabled.includes(feature) &&
          (extra.includes(feature) || DEFAULT_ENABLED_UI_FEATURES.has(feature)),
      );
    };

    const enablePrompts = () => setFeatures([OverlayFeature.Prompts]);
    /* Explicitly opted out: `prompts` is in the default-enabled set. */
    const disablePrompts = () => setFeatures([], [OverlayFeature.Prompts]);

    const mockPrompts = (
      overrides: Partial<ReturnType<typeof usePrompts>> = {},
    ) =>
      vi.mocked(usePrompts).mockReturnValue({
        prompts: [personalPrompt],
        folders: [],
        sharedWithMe: [],
        publicPrompts: [organisationPrompt],
        publicFolders: [],
        isLoading: false,
        error: null,
        refetchPrompts: vi.fn().mockResolvedValue(undefined),
        refetchPublicPrompts: vi.fn().mockResolvedValue(undefined),
        ...overrides,
      });

    it('adds prompt items to the catalog when the feature is enabled', () => {
      enablePrompts();
      mockPrompts();

      render(<CatalogView />);

      const ids = screen.getByLabelText('Catalog item ids').textContent ?? '';
      expect(ids).toContain('Work/AI/summarize:PROMPT');
      expect(ids).toContain('Public/translate:PROMPT');
    });

    it('adds no prompt items when the feature is disabled', () => {
      disablePrompts();
      mockPrompts();

      render(<CatalogView />);

      const ids = screen.getByLabelText('Catalog item ids').textContent ?? '';
      expect(ids).not.toContain('PROMPT');
    });

    it('excludes prompts from the model picker in selector mode', () => {
      enablePrompts();
      mockPrompts();

      render(<CatalogView isSelectorMode />);

      const ids = screen.getByLabelText('Catalog item ids').textContent ?? '';
      expect(ids).not.toContain('PROMPT');
    });

    it('shows only prompts in selector mode when visibleTypes is set to Prompt', () => {
      enablePrompts();
      mockPrompts();

      render(
        <CatalogView
          isSelectorMode
          visibleTypes={new Set([CatalogEntityType.Prompt])}
        />,
      );

      const ids = screen.getByLabelText('Catalog item ids').textContent ?? '';
      expect(ids).toContain('PROMPT');
      expect(ids).not.toContain(':MODEL');
      expect(ids).not.toContain(':AGENT');
    });

    it('filters personal prompts out when catalog-hide-my-apps is enabled', () => {
      setFeatures([OverlayFeature.Prompts, OverlayFeature.CatalogHideMyApps]);
      mockPrompts();

      render(<CatalogView />);

      const ids = screen.getByLabelText('Catalog item ids').textContent ?? '';
      expect(ids).not.toContain('Work/AI/summarize');
      expect(ids).toContain('Public/translate:PROMPT');
    });

    it('fetches a personal prompt through getPrompt and never the deployment endpoints', async () => {
      enablePrompts();
      mockPrompts();
      vi.mocked(getPrompt).mockResolvedValue(personalPrompt);

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'fetch details Work/AI/summarize' }),
      );

      expect(getPrompt).toHaveBeenCalledWith('Work/AI/summarize');
      expect(getPublicPrompt).not.toHaveBeenCalled();
      expect(getDeploymentDetails).not.toHaveBeenCalled();
      expect(getDeploymentLimits).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(
          screen.getByLabelText('Fetch details result').textContent,
        ).toContain('Summarize the following text:'),
      );
    });

    it('fetches an organisation prompt through getPublicPrompt', async () => {
      enablePrompts();
      mockPrompts();
      vi.mocked(getPublicPrompt).mockResolvedValue(organisationPrompt);

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'fetch details Public/translate' }),
      );

      expect(getPublicPrompt).toHaveBeenCalledWith('Public/translate');
      expect(getPrompt).not.toHaveBeenCalled();
    });

    it('resolves undefined when the prompt fetch fails', async () => {
      enablePrompts();
      mockPrompts();
      vi.mocked(getPrompt).mockRejectedValue(new Error('502'));

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'fetch details Work/AI/summarize' }),
      );

      await waitFor(() =>
        expect(screen.getByLabelText('Fetch details result').textContent).toBe(
          'null',
        ),
      );
    });

    it('deletes a prompt through deletePrompt and refetches', async () => {
      enablePrompts();
      const refetchPrompts = vi.fn().mockResolvedValue(undefined);
      mockPrompts({ refetchPrompts });
      vi.mocked(deletePrompt).mockResolvedValue(undefined);

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'delete Work/AI/summarize' }),
      );

      expect(deletePrompt).toHaveBeenCalledWith('Work/AI/summarize');
      expect(refetchPrompts).toHaveBeenCalledOnce();
      expect(deleteApplication).not.toHaveBeenCalled();
    });

    it('surfaces an error notification when deleting a prompt fails', async () => {
      enablePrompts();
      mockPrompts();
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      vi.mocked(deletePrompt).mockRejectedValue(new Error('502'));

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'delete Work/AI/summarize' }),
      );

      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      );
    });

    it('offers a favourite control but no unshare control for a prompt', () => {
      enablePrompts();
      mockPrompts();
      vi.mocked(useDeployments).mockReturnValue({
        ...vi.mocked(useDeployments)(),
        items: [
          {
            id: 'shared-model',
            displayName: 'Shared model',
            type: 'model',
            isMy: false,
            sharedWithMe: true,
          },
        ],
      } as ReturnType<typeof useDeployments>);

      render(<CatalogView />);

      expect(
        screen.getByRole('button', { name: 'favorite Work/AI/summarize' }),
      ).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: 'unshare Work/AI/summarize' }),
      ).toBeNull();
      expect(
        screen.getByRole('button', { name: 'favorite shared-model' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'unshare shared-model' }),
      ).toBeTruthy();
    });

    it('toggles a prompt favourite through the prompts user-config section', async () => {
      enablePrompts();
      mockPrompts();
      const toggleFavorite = vi.fn();
      vi.mocked(useFavoriteApplications).mockReturnValue({
        favoriteIds: new Set(),
        isLoading: false,
        toggleFavorite,
      });

      render(<CatalogView />);

      await user.click(
        screen.getByRole('button', { name: 'favorite Work/AI/summarize' }),
      );

      expect(toggleFavorite).toHaveBeenCalledWith(
        'Work/AI/summarize',
        true,
        FavoriteEntityType.Prompt,
      );
    });

    it('marks a prompt whose path is in favoriteIds as starred', () => {
      enablePrompts();
      mockPrompts();
      vi.mocked(useFavoriteApplications).mockReturnValue({
        favoriteIds: new Set(['Work/AI/summarize']),
        isLoading: false,
        toggleFavorite: vi.fn(),
      });

      render(<CatalogView />);

      expect(screen.getByLabelText('Favorite item ids').textContent).toContain(
        'Work/AI/summarize',
      );
    });

    it('shows the primary action for a prompt', () => {
      enablePrompts();
      mockPrompts();

      render(<CatalogView />);

      expect(
        screen.getByRole('button', { name: 'use in chat Work/AI/summarize' }),
      ).toBeTruthy();
    });
  });

  describe('prompt use in chat', () => {
    const personalPrompt = {
      id: 'Work/AI/summarize',
      name: 'summarize',
      content: 'Summarize the following text:',
      folderId: 'Work/AI',
      createdAt: 1,
      updatedAt: 2,
    };

    /*
     * Resets before setting the implementation: an earlier test in this file
     * uses `mockReturnValue`, which takes precedence over an implementation
     * set afterwards and would otherwise leak "every feature enabled" here.
     */
    const setFeatures = (
      extra: OverlayFeature[] = [],
      disabled: OverlayFeature[] = [],
    ) => {
      vi.mocked(useUiFeature).mockReset();
      vi.mocked(useUiFeature).mockImplementation(
        (feature) =>
          !disabled.includes(feature) &&
          (extra.includes(feature) || DEFAULT_ENABLED_UI_FEATURES.has(feature)),
      );
    };

    const enablePrompts = () => setFeatures([OverlayFeature.Prompts]);
    /* Explicitly opted out: `prompts` is in the default-enabled set. */
    const disablePrompts = () => setFeatures([], [OverlayFeature.Prompts]);

    const mockPrompts = (prompts = [personalPrompt]) =>
      vi.mocked(usePrompts).mockReturnValue({
        prompts,
        folders: [],
        sharedWithMe: [],
        publicPrompts: [],
        publicFolders: [],
        isLoading: false,
        error: null,
        refetchPrompts: vi.fn().mockResolvedValue(undefined),
        refetchPublicPrompts: vi.fn().mockResolvedValue(undefined),
      });

    it('navigates to the composer with the body in router state, leaving the deployment selection alone', async () => {
      enablePrompts();
      mockPrompts();
      const setSelectedItemId = vi.fn();
      vi.mocked(useDeployments).mockReturnValue({
        ...vi.mocked(useDeployments)(),
        setSelectedItemId,
      } as ReturnType<typeof useDeployments>);

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'use in chat Work/AI/summarize' }),
      );

      expect(mockNavigate).toHaveBeenCalledWith('/', {
        state: { promptContent: 'Summarize the following text:' },
      });
      expect(setSelectedItemId).not.toHaveBeenCalled();
    });

    it('resolves the body through getPrompt when the list did not carry it', async () => {
      enablePrompts();
      mockPrompts([{ ...personalPrompt, content: '' }]);
      vi.mocked(getPrompt).mockResolvedValue(personalPrompt);

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'use in chat Work/AI/summarize' }),
      );

      expect(getPrompt).toHaveBeenCalledWith('Work/AI/summarize');
      expect(mockNavigate).toHaveBeenCalledWith('/', {
        state: { promptContent: 'Summarize the following text:' },
      });
    });

    it('stays on the catalog and notifies when the body cannot be resolved', async () => {
      enablePrompts();
      mockPrompts([{ ...personalPrompt, content: '' }]);
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      vi.mocked(getPrompt).mockRejectedValue(new Error('502'));

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'use in chat Work/AI/summarize' }),
      );

      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('opens the prompt editor with the prompt id when Edit is activated', async () => {
      enablePrompts();
      mockPrompts();

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'edit Work/AI/summarize' }),
      );

      expect(mockNavigate).toHaveBeenCalledWith(
        '/prompt-editor?id=Work%2FAI%2Fsummarize&returnUrl=%2Fcatalog',
      );
    });

    it('offers a Prompt create option only when the feature is enabled', async () => {
      enablePrompts();
      mockPrompts();

      const { unmount } = render(<CatalogView />);
      expect(
        screen.getByRole('button', { name: 'catalog.create.prompt' }),
      ).toBeTruthy();
      unmount();

      disablePrompts();
      render(<CatalogView />);
      expect(
        screen.queryByRole('button', { name: 'catalog.create.prompt' }),
      ).toBeNull();
    });

    it('navigates to the editor in create mode from the Prompt create option', async () => {
      enablePrompts();
      mockPrompts();

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'catalog.create.prompt' }),
      );

      expect(mockNavigate).toHaveBeenCalledWith(
        '/prompt-editor?returnUrl=%2Fcatalog',
      );
    });

    it('still selects the deployment and navigates for a model item', async () => {
      const setSelectedItemId = vi.fn();
      vi.mocked(useDeployments).mockReturnValue({
        ...vi.mocked(useDeployments)(),
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
        setSelectedItemId,
      } as ReturnType<typeof useDeployments>);

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'use in chat gpt-4o' }),
      );

      expect(setSelectedItemId).toHaveBeenCalledWith('gpt-4o');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
  describe('revoke access', () => {
    const ownedApplication = {
      id: 'applications/my-bucket/My App__1.0',
      displayName: 'My App',
      type: 'application',
      isMy: true,
      sharedWithMe: false,
    };

    const mockDeployments = (
      overrides: Partial<ReturnType<typeof useDeployments>>,
    ) =>
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
        ...overrides,
      } as ReturnType<typeof useDeployments>);

    it('revokes access, notifies, and leaves the catalog lists and selection untouched', async () => {
      const refetchToolsets = vi.fn().mockResolvedValue(undefined);
      const refetchDeployments = vi.fn().mockResolvedValue(undefined);
      const setSelectedItemId = vi.fn();
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      mockDeployments({
        items: [ownedApplication],
        selectedItemId: ownedApplication.id,
        setSelectedItemId,
        refetchToolsets,
        refetchDeployments,
      } as Partial<ReturnType<typeof useDeployments>>);
      vi.mocked(revokeSharedAccess).mockResolvedValue({ success: true });

      render(<CatalogView />);

      await user.click(
        screen.getByRole('button', { name: `revoke ${ownedApplication.id}` }),
      );

      expect(revokeSharedAccess).toHaveBeenCalledWith(ownedApplication.id);
      expect(refetchToolsets).not.toHaveBeenCalled();
      expect(refetchDeployments).not.toHaveBeenCalled();
      expect(setSelectedItemId).not.toHaveBeenCalled();
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      );
    });

    it('shows an error notification carrying the trace id when revokeSharedAccess rejects', async () => {
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      mockDeployments({
        items: [ownedApplication],
      } as Partial<ReturnType<typeof useDeployments>>);
      vi.mocked(revokeSharedAccess).mockRejectedValue(
        new Error('network error'),
      );

      render(<CatalogView />);

      await user.click(
        screen.getByRole('button', { name: `revoke ${ownedApplication.id}` }),
      );

      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      );
      expect(showNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      );
    });
  });

  describe('prompt download', () => {
    const personalPrompt = {
      id: 'Work/AI/summarize',
      name: 'summarize',
      description: 'Summarize a document',
      content: 'Summarize:\n\n{{document}}',
      folderId: 'Work/AI',
      createdAt: 1,
      updatedAt: 2,
    };

    const organisationPrompt = {
      ...personalPrompt,
      id: 'Public/translate',
      name: 'translate',
      folderId: 'Public',
    };

    const enablePrompts = () => {
      vi.mocked(useUiFeature).mockReset();
      vi.mocked(useUiFeature).mockImplementation(
        (feature) =>
          feature === OverlayFeature.Prompts ||
          DEFAULT_ENABLED_UI_FEATURES.has(feature),
      );
    };

    const mockPrompts = () =>
      vi.mocked(usePrompts).mockReturnValue({
        prompts: [personalPrompt],
        folders: [],
        sharedWithMe: [],
        publicPrompts: [organisationPrompt],
        publicFolders: [],
        isLoading: false,
        error: null,
        refetchPrompts: vi.fn().mockResolvedValue(undefined),
        refetchPublicPrompts: vi.fn().mockResolvedValue(undefined),
      });

    /* jsdom's Blob has no `text()`, so the written file is read through FileReader. */
    const readDownloadedFile = async (): Promise<{
      fileName: string;
      envelope: {
        version: number;
        prompts: { id: string; content: string; folderId?: string }[];
        folders: { id: string; name: string; folderId?: string }[];
      };
    }> => {
      const [blob, fileName] = vi.mocked(triggerBlobDownload).mock.calls[0];
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
      return { fileName, envelope: JSON.parse(text) };
    };

    it('writes a personal prompt as a version 5 envelope fetched through getPrompt', async () => {
      enablePrompts();
      mockPrompts();
      vi.mocked(getPrompt).mockResolvedValue(personalPrompt);

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'download Work/AI/summarize' }),
      );

      expect(getPrompt).toHaveBeenCalledWith('Work/AI/summarize');
      await waitFor(() => expect(triggerBlobDownload).toHaveBeenCalledOnce());

      const { fileName, envelope } = await readDownloadedFile();
      expect(fileName).toMatch(
        /^\d{4}-\d{2}-\d{2}_ai_dial_prompt_summarize\.json$/,
      );
      expect(envelope.version).toBe(5);
      expect(envelope.prompts[0]).toMatchObject({
        id: 'Work/AI/summarize',
        content: 'Summarize:\n\n{{document}}',
        folderId: 'Work/AI',
      });
      expect(envelope.folders).toEqual([
        { id: 'Work', name: 'Work' },
        { id: 'Work/AI', name: 'AI', folderId: 'Work' },
      ]);
    });

    it('fetches an organisation prompt through the public endpoint', async () => {
      enablePrompts();
      mockPrompts();
      vi.mocked(getPublicPrompt).mockResolvedValue(organisationPrompt);

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'download Public/translate' }),
      );

      expect(getPublicPrompt).toHaveBeenCalledWith('Public/translate');
      expect(getPrompt).not.toHaveBeenCalled();
      await waitFor(() => expect(triggerBlobDownload).toHaveBeenCalledOnce());
    });

    it('re-fetches the body instead of writing the content seeded by the listing', async () => {
      enablePrompts();
      mockPrompts();
      vi.mocked(getPrompt).mockResolvedValue({
        ...personalPrompt,
        content: 'Edited elsewhere',
      });

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'download Work/AI/summarize' }),
      );
      await waitFor(() => expect(triggerBlobDownload).toHaveBeenCalledOnce());

      const { envelope } = await readDownloadedFile();
      expect(envelope.prompts[0].content).toBe('Edited elsewhere');
    });

    /*
     * Lives here rather than in the revoke describe because it needs the prompt
     * fixtures: `RevokeSharedAccessDto` rejects prompt paths, so the action must
     * not reach the user even though the item is one they own.
     */
    it('offers no revoke access on a personal prompt', () => {
      enablePrompts();
      mockPrompts();
      vi.mocked(useDeployments).mockReturnValue({
        ...vi.mocked(useDeployments)(),
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
      });

      render(<CatalogView />);

      expect(
        screen.queryByRole('button', { name: 'revoke Work/AI/summarize' }),
      ).toBeNull();
      expect(
        screen.getByRole('button', { name: 'revoke gpt-4o' }),
      ).toBeTruthy();
    });

    it('offers no download for an item that is not a prompt', () => {
      enablePrompts();
      mockPrompts();
      vi.mocked(useDeployments).mockReturnValue({
        ...vi.mocked(useDeployments)(),
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
      });

      render(<CatalogView />);

      expect(
        screen.getByRole('button', { name: 'download Work/AI/summarize' }),
      ).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: 'download gpt-4o' }),
      ).toBeNull();
    });

    it('reports a failed download and writes no file', async () => {
      enablePrompts();
      mockPrompts();
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        notifications: [],
        showNotification,
        dismissNotification: vi.fn(),
      });
      vi.mocked(getPrompt).mockRejectedValue(new Error('502'));

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', { name: 'download Work/AI/summarize' }),
      );

      await waitFor(() =>
        expect(showNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'error',
            message: CatalogI18nKeys.DetailsPromptDownloadError,
          }),
        ),
      );
      expect(triggerBlobDownload).not.toHaveBeenCalled();
    });
  });
});
