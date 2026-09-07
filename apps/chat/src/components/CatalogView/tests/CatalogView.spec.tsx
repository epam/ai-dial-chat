import type { CatalogItem } from '@epam/ai-dial-catalog';
import {
  CatalogSortKey,
  CredentialsBadgeState,
  getCredentialsBadgeState,
  getCredentialsUiState,
} from '@epam/ai-dial-catalog';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import { DropdownItem } from '@epam/ai-dial-ui-kit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogI18nKeys } from '../../../constants/translation-keys';
import { DEFAULT_ENABLED_UI_FEATURES } from '../../../constants/ui-features';
import { useAppConfig } from '../../../context/AppConfigContext';
import { useUser } from '../../../context/auth/UserContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useFavoriteApplications } from '../../../context/FavoriteApplicationsContext';
import { useNotification } from '../../../context/NotificationContext';
import { usePrompts } from '../../../context/PromptsContext';
import { useSkills } from '../../../context/SkillsContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import { useCatalogActiveTabPreference } from '../../../hooks/useCatalogActiveTabPreference/useCatalogActiveTabPreference';
import { useCatalogSortFilterPreference } from '../../../hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference';
import { useUiFeature } from '../../../hooks/useUiFeature';
import { getDeploymentLimits } from '../../../server-api/deployment-limits';
import { AuthStatus } from '../../../types/auth-status';
import { UserConfigStatus } from '../../../types/user-config-status';
import CatalogView from '../CatalogView';

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
    onPublishSuccess?: (item: CatalogItem, folderPath: string[]) => void;
    getPublishHistory?: (item: CatalogItem) => Promise<unknown[]>;
    isPublishVisible?: (item: CatalogItem) => boolean;
    onUnpublish?: (item: CatalogItem, folderPath: string[]) => Promise<void>;
    isUnpublishVisible?: (item: CatalogItem) => boolean;
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
    activeTab?: string;
    onActiveTabChange?: (tabId: string) => void;
  } | null;
} = { current: null };

const capturedContentFileProps: {
  current: {
    onLoadContentFile?: (fileId: string) => Promise<string | undefined>;
    renderContentFilePreview?: (fileId: string, fileName: string) => ReactNode;
  } | null;
} = { current: null };

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

vi.mock('../../../server-api/publish.api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  publishCatalogEntity: vi.fn(),
  unpublishCatalogEntity: vi.fn(),
  getCatalogPublishHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../server-api/publish-rules.api', () => ({
  getPublishRules: vi.fn().mockResolvedValue([]),
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
    onFetchRecipientsCount,
    isRevokeShareVisible,
    onFetchDetails,
    onLoadContentFile,
    renderContentFilePreview,
    onLogin,
    onLogout,
    initialDetailsItemId,
    publishFolderItems,
    publishExpandedPaths,
    onPublishExpandedPathsChange,
    publishLoadingPaths,
    onCreatePublishFolder,
    onPublish,
    onPublishSuccess,
    getPublishHistory,
    isPublishVisible,
    onUnpublish,
    isUnpublishVisible,
    ruleSourceOptions,
    onFetchExistingRules,
    isShareVisible,
    sortKey,
    onSortChange,
    filterTopics,
    onFilterTopicsChange,
    isMyAppsActive,
    onMyAppsActiveChange,
    activeTab,
    onActiveTabChange,
    isFullWidth,
  }: {
    isFullWidth?: boolean;
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
    onFetchRecipientsCount?: (item: CatalogItem) => Promise<number | undefined>;
    isRevokeShareVisible?: (item: CatalogItem) => boolean;
    onFetchDetails?: (item: CatalogItem) => Promise<unknown>;
    onLoadContentFile?: (fileId: string) => Promise<string | undefined>;
    renderContentFilePreview?: (fileId: string, fileName: string) => ReactNode;
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
    onPublishSuccess?: (item: CatalogItem, folderPath: string[]) => void;
    getPublishHistory?: (item: CatalogItem) => Promise<unknown[]>;
    isPublishVisible?: (item: CatalogItem) => boolean;
    onUnpublish?: (item: CatalogItem, folderPath: string[]) => Promise<void>;
    isUnpublishVisible?: (item: CatalogItem) => boolean;
    ruleSourceOptions?: string[];
    onFetchExistingRules?: (folderPath: string[]) => Promise<PublicationRule[]>;
    isShareVisible?: (item: CatalogItem) => boolean;
    sortKey?: string;
    onSortChange?: (key: string) => void;
    filterTopics?: Set<string>;
    onFilterTopicsChange?: (topics: Set<string>) => void;
    isMyAppsActive?: boolean;
    onMyAppsActiveChange?: (isActive: boolean) => void;
    activeTab?: string;
    onActiveTabChange?: (tabId: string) => void;
  }) => {
    const [fetchResult, setFetchResult] = useState<string>('');
    const [recipientsCount, setRecipientsCount] = useState<string>('');
    capturedPublishProps.current = {
      onPublish,
      onPublishSuccess,
      getPublishHistory,
      isPublishVisible,
      onUnpublish,
      isUnpublishVisible,
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
      activeTab,
      onActiveTabChange,
    };
    capturedContentFileProps.current = {
      onLoadContentFile,
      renderContentFilePreview,
    };

    return (
      <div>
        <output aria-label="Catalog item ids">
          {(items ?? []).map((item) => `${item.id}:${item.type}`).join(',')}
        </output>
        <output aria-label="Is full width">
          {String(Boolean(isFullWidth))}
        </output>
        <output aria-label="Active tab">{activeTab ?? ''}</output>
        <button type="button" onClick={() => onActiveTabChange?.('PROMPT')}>
          switch to Prompts tab
        </button>
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
        {(items ?? [])
          .filter((item) => item.isEditable)
          .map((item) => (
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
        {/* Stands in for the real Header's Manage-menu open, which is what
         * triggers the recipient-count lookup. */}
        {(items ?? []).map((item) => (
          <button
            key={`recipients-count-${item.id}`}
            type="button"
            onClick={async () => {
              try {
                const count = await onFetchRecipientsCount?.(item);
                setRecipientsCount(String(count));
              } catch {
                /* The real Header treats a rejection as "count unknown". */
                setRecipientsCount('unknown');
              }
            }}
          >
            recipients count {item.id}
          </button>
        ))}
        <output aria-label="Recipients count result">{recipientsCount}</output>
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
        {(createOptions ?? []).flatMap((option) => [
          <button
            key={option.key}
            type="button"
            onClick={(domEvent) =>
              option.onClick?.({ key: option.key, domEvent })
            }
          >
            {option.label}
          </button>,
          // eslint-disable-next-line testing-library/no-node-access -- `option.children` is a DropdownItem field, not a DOM node
          ...(option.children ?? []).map((child) => (
            <button
              key={child.key}
              type="button"
              onClick={(domEvent) =>
                child.onClick?.({ key: child.key, domEvent })
              }
            >
              {child.label}
            </button>
          )),
        ])}
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
  getShareRecipientsCount: vi.fn(),
}));

vi.mock('../../../context/PromptsContext', () => ({
  usePrompts: vi.fn(),
}));

vi.mock('../../../server-api/prompts.api', () => ({
  getPrompt: vi.fn(),
  getPublicPrompt: vi.fn(),
  deletePrompt: vi.fn(),
}));

vi.mock('../../../context/SkillsContext', () => ({
  useSkills: vi.fn(),
}));

vi.mock('../../../server-api/skills.api', () => ({
  downloadSkill: vi.fn(),
  downloadSkillFile: vi.fn(),
  listSkillFiles: vi.fn(),
  deleteSkill: vi.fn(),
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

vi.mock(
  '../../../hooks/useCatalogActiveTabPreference/useCatalogActiveTabPreference',
  () => ({
    useCatalogActiveTabPreference: vi.fn(),
  }),
);

describe('CatalogView', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUiFeature).mockImplementation((feature) =>
      DEFAULT_ENABLED_UI_FEATURES.has(feature),
    );
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
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      selectedDeploymentDetails: null,
      isDeploymentDetailsLoading: false,
      mergeSharedItem: vi.fn(),
    });
    vi.mocked(getDeploymentLimits).mockResolvedValue({});
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(vi.fn()),
    );
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
    vi.mocked(useSkills).mockReturnValue({
      skills: [],
      publicSkills: [],
      isLoading: false,
      error: null,
      refetchSkills: vi.fn().mockResolvedValue(undefined),
      mergeSharedSkill: vi.fn(),
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
    vi.mocked(useCatalogActiveTabPreference).mockReturnValue({
      activeTab: 'MODEL',
      setActiveTab: vi.fn(),
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
        mcpAppSandboxUrl: null,
        mcpAppTheme: null,
        mcpAppUserAgent: null,
        fileManagerTabs: ['my_files', 'shared', 'organization'],
        overlayEnabled: false,
        overlayAllowedOrigins: [],
        enabledUiFeatures: null,
        announcementHtml: null,
        announcementTitle: null,
        announcementDescription: null,
        announcements: [],
        footerHtmlMessage: '',
        customVisualizers: [],
        publicationFilterSources: ['title', 'role', 'dial_roles'],
      },
    });
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

  describe('publish wiring', () => {
    it('sources ruleSourceOptions from useAppConfig, not a hardcoded list', () => {
      render(<CatalogView />);

      expect(capturedPublishProps.current?.ruleSourceOptions).toEqual([
        'title',
        'role',
        'dial_roles',
      ]);
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
        selectedDeploymentDetails: null,
        isDeploymentDetailsLoading: false,
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

  describe('active tab persistence wiring', () => {
    it('passes the persisted activeTab through to Catalog', () => {
      vi.mocked(useCatalogActiveTabPreference).mockReturnValue({
        activeTab: 'PROMPT',
        setActiveTab: vi.fn(),
      });

      render(<CatalogView />);

      expect(capturedPublishProps.current?.activeTab).toBe('PROMPT');
    });

    it('forwards Catalog tab switches to the persistence hook setter', () => {
      const setActiveTab = vi.fn();
      vi.mocked(useCatalogActiveTabPreference).mockReturnValue({
        activeTab: 'MODEL',
        setActiveTab,
      });

      render(<CatalogView />);
      capturedPublishProps.current?.onActiveTabChange?.('PROMPT');

      expect(setActiveTab).toHaveBeenCalledWith('PROMPT');
    });

    it('does not forward the activeTab controlled props in selector mode', () => {
      render(<CatalogView isSelectorMode onClose={vi.fn()} />);

      expect(capturedPublishProps.current?.activeTab).toBeUndefined();
      expect(capturedPublishProps.current?.onActiveTabChange).toBeUndefined();
    });

    it('restores the origin tab after remounting with the same persisted value, as happens when an editor navigates back to Catalog', () => {
      vi.mocked(useCatalogActiveTabPreference).mockReturnValue({
        activeTab: 'PROMPT',
        setActiveTab: vi.fn(),
      });

      const { unmount } = render(<CatalogView />);
      expect(capturedPublishProps.current?.activeTab).toBe('PROMPT');

      // Simulate the editor's `navigate(returnUrl)` back to the bare
      // `ROUTES.Catalog`, which remounts `CatalogView`. The hook still
      // resolves the same persisted value from `localStorage`.
      unmount();
      render(<CatalogView />);

      expect(capturedPublishProps.current?.activeTab).toBe('PROMPT');
    });
  });

  describe('Props contract equivalence', () => {
    it('forwards isFullWidth through to Catalog', () => {
      render(<CatalogView isFullWidth />);

      expect(screen.getByLabelText('Is full width').textContent).toBe('true');
    });

    it('defaults isFullWidth to false when not supplied', () => {
      render(<CatalogView />);

      expect(screen.getByLabelText('Is full width').textContent).toBe('false');
    });

    it('routes a card pick through the onSelect prop in selector mode', async () => {
      vi.mocked(useDeployments).mockReturnValue({
        ...vi.mocked(useDeployments)(),
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
      });
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <CatalogView isSelectorMode onClose={onClose} onSelect={onSelect} />,
      );
      await user.click(
        screen.getByRole('button', { name: 'card select gpt-4o' }),
      );

      expect(onSelect).toHaveBeenCalledWith('gpt-4o');
    });

    it('restricts visible items to the entity types listed in visibleTypes', () => {
      vi.mocked(useDeployments).mockReturnValue({
        ...vi.mocked(useDeployments)(),
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
        toolsets: [
          {
            id: 'search-tool',
            name: 'Search Tool',
            authenticationType: 'NONE',
          },
        ] as unknown as ReturnType<typeof useDeployments>['toolsets'],
      });

      render(
        <CatalogView
          isSelectorMode
          onClose={vi.fn()}
          visibleTypes={new Set([CatalogEntityType.Model])}
        />,
      );

      const ids = screen.getByLabelText('Catalog item ids').textContent ?? '';
      expect(ids).toContain('gpt-4o');
      expect(ids).not.toContain('search-tool');
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
      expect(container.innerHTML).toBe('');
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
  });

  describe('prompt wiring', () => {
    const personalPrompt = {
      id: 'prompts/my-bucket/Work/AI/summarize',
      name: 'summarize',
      description: 'Summarize a document',
      content: 'Summarize the following text:',
      folderId: 'Work/AI',
      createdAt: 1,
      updatedAt: 2,
    };

    const organisationPrompt = {
      ...personalPrompt,
      id: 'prompts/public/Public/translate',
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

    it('offers both a favourite and an unshare control for a prompt', () => {
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
        screen.getByRole('button', {
          name: 'favorite prompts/my-bucket/Work/AI/summarize',
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: 'unshare prompts/my-bucket/Work/AI/summarize',
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'favorite shared-model' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'unshare shared-model' }),
      ).toBeTruthy();
    });

    /*
     * Cross-hook: whether the Edit button renders at all is `useCatalogItems`'
     * `isEditable` derivation, while the navigation it triggers on click is
     * `useCatalogEditNavigation`'s `handleEdit`.
     */
    it('opens the prompt editor for a writable shared prompt', async () => {
      enablePrompts();
      mockPrompts({
        prompts: [],
        sharedWithMe: [
          {
            ...personalPrompt,
            id: 'prompts/owner-bucket/Work/AI/summarize',
            isMy: false,
            canEdit: true,
            sharedWithMe: true,
          },
        ],
      });

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', {
          name: 'edit prompts/owner-bucket/Work/AI/summarize',
        }),
      );

      expect(mockNavigate).toHaveBeenCalledWith(
        '/prompt-editor?id=prompts%2Fowner-bucket%2FWork%2FAI%2Fsummarize&returnUrl=%2Fcatalog',
      );
    });
  });

  describe('prompt download', () => {
    const personalPrompt = {
      id: 'prompts/my-bucket/Work/AI/summarize',
      name: 'summarize',
      description: 'Summarize a document',
      content: 'Summarize:\n\n{{document}}',
      folderId: 'Work/AI',
      createdAt: 1,
      updatedAt: 2,
    };

    const organisationPrompt = {
      ...personalPrompt,
      id: 'prompts/public/Public/translate',
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

    /*
     * Lives here rather than in the revoke describe because it needs the
     * prompt fixtures: `RevokeSharedAccessDto` now accepts a full
     * `prompts/{bucket}/{path}` id like any other entity type, so revoke
     * access is offered for an owned prompt exactly like an owned
     * application.
     */
    it('offers revoke access on a personal prompt', () => {
      enablePrompts();
      mockPrompts();
      vi.mocked(useDeployments).mockReturnValue({
        ...vi.mocked(useDeployments)(),
        items: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' }],
      });

      render(<CatalogView />);

      expect(
        screen.getByRole('button', {
          name: 'revoke prompts/my-bucket/Work/AI/summarize',
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'revoke gpt-4o' }),
      ).toBeTruthy();
    });
  });

  describe('skill wiring', () => {
    const personalSkill = {
      name: 'revenue-skill',
      path: 'analysis/revenue-skill',
      url: 'skills/my-bucket/analysis/revenue-skill',
      bucket: 'my-bucket',
      nodeType: 'item' as const,
      parentPath: 'analysis/',
      author: 'alice',
      updatedAt: 2,
    };

    const organisationSkill = {
      ...personalSkill,
      name: 'shared-skill',
      path: 'shared-skill',
      url: 'skills/public/shared-skill',
      bucket: 'public',
      parentPath: undefined,
    };

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

    const enableSkills = () => setFeatures([OverlayFeature.Skills]);

    const mockSkills = (
      overrides: Partial<ReturnType<typeof useSkills>> = {},
    ) =>
      vi.mocked(useSkills).mockReturnValue({
        skills: [personalSkill],
        publicSkills: [organisationSkill],
        isLoading: false,
        error: null,
        refetchSkills: vi.fn().mockResolvedValue(undefined),
        mergeSharedSkill: vi.fn(),
        ...overrides,
      });

    /*
     * Cross-hook: whether the Edit button renders at all is `useCatalogItems`'
     * `isEditable` derivation, while the navigation it triggers on click is
     * `useCatalogEditNavigation`'s `handleEdit`.
     */
    it('opens the skill editor for a writable shared skill', async () => {
      enableSkills();
      mockSkills({
        skills: [],
        publicSkills: [],
        sharedWithMe: [
          {
            ...personalSkill,
            url: 'skills/owner-bucket/analysis/revenue-skill',
            bucket: 'owner-bucket',
            isMy: false,
            canEdit: true,
            sharedWithMe: true,
          },
        ],
      });

      render(<CatalogView />);
      await user.click(
        screen.getByRole('button', {
          name: 'edit skills/owner-bucket/analysis/revenue-skill',
        }),
      );

      expect(mockNavigate).toHaveBeenCalledWith(
        '/skill-editor?id=skills%2Fowner-bucket%2Fanalysis%2Frevenue-skill&returnUrl=%2Fcatalog',
      );
    });

    /* A skill has no chat interface, so it never offers Use in chat; download, unshare, and revoke are all backed by DTOs that accept a skills path. */
    it('hides Use in chat for a skill while offering download, unshare, and revoke', () => {
      enableSkills();
      mockSkills();

      render(<CatalogView />);

      const skillId = 'skills/my-bucket/analysis/revenue-skill';
      expect(
        screen.queryByRole('button', { name: `use in chat ${skillId}` }),
      ).toBeNull();
      expect(
        screen.getByRole('button', { name: `download ${skillId}` }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: `unshare ${skillId}` }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: `revoke ${skillId}` }),
      ).toBeTruthy();
    });

    it('notifies once when the skill listing fails and still renders the catalog', async () => {
      enableSkills();
      const showNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue(
        createNotificationContextValue(showNotification),
      );
      mockSkills({ skills: [], publicSkills: [], error: new Error('down') });

      render(<CatalogView />);

      await waitFor(() =>
        expect(showNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'error',
            message: CatalogI18nKeys.SkillsLoadError,
          }),
        ),
      );
      expect(showNotification).toHaveBeenCalledOnce();
      expect(screen.getByLabelText('Catalog item ids')).toBeTruthy();
    });
  });
});
