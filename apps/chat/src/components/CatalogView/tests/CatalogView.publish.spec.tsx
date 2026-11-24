import type { CatalogItem } from '@epam/ai-dial-catalog';
import { CatalogSortKey } from '@epam/ai-dial-catalog';
import {
  CatalogCreationType,
  CelebrationDeliveryMode,
} from '@epam/ai-dial-chat-api-client';
import { SpendingLimitsMode } from '@epam/ai-dial-chat-hooks';
import {
  canApprovePublicationsAt,
  canWriteIntoOrgUnitAt,
  CatalogEntityType,
  OrgUnitNamespace,
  type OrgUnit,
} from '@epam/ai-dial-chat-shared';
import {
  PublishDependencyType,
  type PublishDependency,
} from '@epam/ai-dial-publish-panel';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CatalogI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../../constants/translation-keys';
import { DEFAULT_ENABLED_UI_FEATURES } from '../../../constants/ui-features';
import {
  useAppConfig,
  useFeatureFlag,
} from '../../../context/AppConfigContext';
import { useUser } from '../../../context/auth/UserContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useFavoriteApplications } from '../../../context/FavoriteApplicationsContext';
import { useNotification } from '../../../context/NotificationContext';
import { useOrgUnitsContext } from '../../../context/OrgUnitsContext';
import { usePrompts } from '../../../context/PromptsContext';
import { useSkills } from '../../../context/SkillsContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { useOrgUnitFolderGuards } from '../../../hooks/publish/useOrgUnitFolderGuards';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import { useCatalogActiveTabPreference } from '../../../hooks/useCatalogActiveTabPreference/useCatalogActiveTabPreference';
import { useCatalogSortFilterPreference } from '../../../hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference';
import { useUiFeature } from '../../../hooks/useUiFeature';
import { getDeploymentLimits } from '../../../server-api/deployment-limits';
import {
  copyCatalogEntityToOrgUnit,
  publishCatalogEntity,
} from '../../../server-api/publish.api';
import { AuthStatus } from '../../../types/auth-status';
import { UserConfigStatus } from '../../../types/user-config-status';
import CatalogView from '../CatalogView';

const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
const mockSearchParams = new URLSearchParams();

interface CapturedProps {
  canPublishDirectlyTo?: (
    item: CatalogItem,
    folderPath: string[],
    dependencies: PublishDependency[],
  ) => boolean;
  onPublishDirectly?: (
    item: CatalogItem,
    folderPath: string[],
  ) => Promise<void>;
  onPublishSuccess?: (
    item: CatalogItem,
    folderPath: string[],
    isDirectWrite: boolean,
  ) => void;
  getPublishDirectUnavailableNote?: (
    item: CatalogItem,
    folderPath: string[],
    dependencies: PublishDependency[],
  ) => string | undefined;
  publishLabels?: { directWriteNote?: string };
}

const captured: { current: CapturedProps } = { current: {} };

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  Link: ({ children }: { children?: unknown }) => children,
}));

vi.mock('../../../server-api/publish.api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  publishCatalogEntity: vi.fn(),
  copyCatalogEntityToOrgUnit: vi.fn(),
  unpublishCatalogEntity: vi.fn(),
  getCatalogPublishHistory: vi.fn().mockResolvedValue([]),
  getCatalogUnpublishAccess: vi.fn(),
}));

vi.mock('../../../context/OrgUnitsContext', () => ({
  useOrgUnitsContext: vi.fn(),
}));

vi.mock('@epam/ai-dial-catalog', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Catalog: (props: CapturedProps) => {
    captured.current = props;
    return null;
  },
}));

vi.mock('../../../context/auth/UserContext', () => ({
  useUser: vi.fn(),
}));

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

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
  getSkillMetadata: vi.fn(),
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

/* The real hook returns nothing for the empty id the catalog passes while no publish panel is open. */
vi.mock('../../../hooks/publish/useResourceVersionHistory', () => ({
  useResourceVersionHistory: vi.fn((resourceId: string) =>
    resourceId === '' ? undefined : { rows: [], resourceId },
  ),
}));
vi.mock('../../../hooks/publish/useOrgUnitFolderGuards', () => ({
  useOrgUnitFolderGuards: vi.fn(),
}));

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

const setupDefaults = () => {
  vi.clearAllMocks();
  vi.mocked(useUiFeature).mockImplementation((feature) =>
    DEFAULT_ENABLED_UI_FEATURES.has(feature),
  );
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
  vi.mocked(useOrgUnitFolderGuards).mockReturnValue({
    isDestinationUsable: undefined,
    getDisabledReason: undefined,
    canSaveDirectlyTo: undefined,
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
    catalogCreationStatus: UserConfigStatus.Ready,
    catalogCreationPermissions: {
      allowedTypes: Object.values(CatalogCreationType),
      restrictedSchemaIds: [],
    },
    config: {
      activeEventId: null,
      appVersion: '0.0.1',
      asrModelId: null,
      transcribeSizeLimitBytes: 5 * 1024 * 1024,
      additionalContentLocales: [],
      defaultDeploymentId: null,
      dialCoreExternalUrl: 'https://dial.example.com',
      mcpAppSandboxUrl: null,
      mcpAppTheme: null,
      mcpAppUserAgent: null,
      mcpAppHostName: null,
      themesBaseUrl: null,
      fileManagerTabs: ['my_files', 'shared', 'organization'],
      overlayEnabled: false,
      overlayAllowedOrigins: [],
      allowedConnectOrigins: [],
      enabledUiFeatures: null,
      announcementHtml: null,
      announcementTitle: null,
      announcementDescription: null,
      announcements: [],
      onboardingHints: [],
      welcomeScreenDescription: null,
      footerHtmlMessage: '',
      customVisualizers: [],
      applicationVisualizers: {},
      maxAttachmentFileSizeBytes: 536_870_912,
      usageLimitsWarningThresholdPercent: 75,
      spendingLimitsMode: SpendingLimitsMode.Off,
      celebrationsEnabledByDefault: true,
      celebrationDelivery: {
        mode: CelebrationDeliveryMode.Bundled,
        revision: '0',
        externalScenes: [],
        externalEvents: [],
      },
      projectContextFileMaxBytes: 1_048_576,
      projectContextTotalMaxBytes: 10_485_760,
      projectContextAllowedExtensions: ['csv', 'pdf', 'xlsx'],
    },
  });
};

const unit = (
  folder: string,
  permissions: Record<string, string[]>,
): OrgUnit => ({
  id: folder,
  name: folder,
  displayName: folder,
  path: folder,
  folder: `public/${folder}/`,
  permissions,
});

/** Sets the org-unit answers the way `useOrgUnits` derives them from units and the admin flag. */
const setRights = (units: OrgUnit[], hasAdminAccess = false) => {
  const access = { hasAdminAccess, units };
  vi.mocked(useOrgUnitsContext).mockReturnValue({
    canPublishDirectlyAt: (path: string, namespace: OrgUnitNamespace) =>
      canWriteIntoOrgUnitAt(access, path, namespace) &&
      canApprovePublicationsAt(access, path),
    canSaveDirectlyAt: (path: string, namespace: OrgUnitNamespace) =>
      canWriteIntoOrgUnitAt(access, path, namespace),
  } as unknown as ReturnType<typeof useOrgUnitsContext>);
};

const application = {
  id: 'applications/b1/App__1.0',
  type: CatalogEntityType.Agent,
  version: '1.0',
  name: 'App',
} as CatalogItem;
const toolsetDependency = {
  id: 'toolsets/b1/Tools',
  name: 'Tools',
  type: PublishDependencyType.Toolset,
  location: '',
} as PublishDependency;

const APPROVER = unit('Delivery', {
  applications: ['read', 'write'],
  toolsets: ['read', 'write'],
  publications: ['read', 'write'],
});

describe('CatalogView — direct publish', () => {
  beforeEach(() => {
    setupDefaults();
    captured.current = {};
    vi.mocked(useFeatureFlag).mockImplementation(
      (key?: string) => key === 'orgUnitsEnabled',
    );
    setRights([APPROVER]);
  });

  it('publishes directly for an approver on a folder of their unit', () => {
    render(<CatalogView />);

    expect(
      captured.current.canPublishDirectlyTo?.(
        application,
        ['Delivery', 'Teams'],
        [],
      ),
    ).toBe(true);
  });

  it('files a request for a writer without the approval right', () => {
    setRights([unit('Delivery', { applications: ['read', 'write'] })]);
    render(<CatalogView />);

    expect(
      captured.current.canPublishDirectlyTo?.(
        application,
        ['Delivery', 'Teams'],
        [],
      ),
    ).toBe(false);
  });

  it('publishes directly for a DIAL admin inside a unit but not outside every unit', () => {
    setRights([unit('Delivery', {})], true);
    render(<CatalogView />);

    expect(
      captured.current.canPublishDirectlyTo?.(application, ['Delivery'], []),
    ).toBe(true);
    expect(
      captured.current.canPublishDirectlyTo?.(application, ['Plain'], []),
    ).toBe(false);
  });

  it('files a request for a folder outside every unit', () => {
    render(<CatalogView />);

    expect(
      captured.current.canPublishDirectlyTo?.(
        application,
        ['Plain', 'Folder'],
        [],
      ),
    ).toBe(false);
  });

  it('never publishes directly while the orgUnitsEnabled flag is off', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);
    render(<CatalogView />);

    expect(
      captured.current.canPublishDirectlyTo?.(application, ['Delivery'], []),
    ).toBe(false);
  });

  it('never publishes directly for a type with no org-unit namespace', () => {
    render(<CatalogView />);

    expect(
      captured.current.canPublishDirectlyTo?.(
        { ...application, type: CatalogEntityType.Model },
        ['Delivery'],
        [],
      ),
    ).toBe(false);
  });

  describe('a dependency namespace the user may not write', () => {
    beforeEach(() => {
      setRights([
        unit('Delivery', {
          applications: ['read', 'write'],
          publications: ['read', 'write'],
        }),
      ]);
    });

    it('falls back to a request and names the missing types in a note', () => {
      render(<CatalogView />);

      expect(
        captured.current.canPublishDirectlyTo?.(
          application,
          ['Delivery'],
          [toolsetDependency],
        ),
      ).toBe(false);
      expect(
        captured.current.getPublishDirectUnavailableNote?.(
          application,
          ['Delivery'],
          [toolsetDependency],
        ),
      ).toBe(CatalogI18nKeys.PublishDirectUnavailableDependencies);
    });

    it('gives no note when there are no dependencies or the entity is not directly publishable anyway', () => {
      render(<CatalogView />);

      expect(
        captured.current.getPublishDirectUnavailableNote?.(
          application,
          ['Delivery'],
          [],
        ),
      ).toBeUndefined();
      expect(
        captured.current.getPublishDirectUnavailableNote?.(
          application,
          ['Plain'],
          [toolsetDependency],
        ),
      ).toBeUndefined();
    });
  });

  it('supplies the credentials note as a translated label', () => {
    render(<CatalogView />);

    expect(captured.current.publishLabels?.directWriteNote).toBe(
      CatalogI18nKeys.PublishDirectCredentialsNote,
    );
  });

  it('writes through the copy operation, never through publish', async () => {
    vi.mocked(copyCatalogEntityToOrgUnit).mockResolvedValue({ id: 'x' });
    render(<CatalogView />);

    await captured.current.onPublishDirectly?.(application, [
      'Delivery',
      'Teams',
    ]);

    expect(copyCatalogEntityToOrgUnit).toHaveBeenCalledWith(
      expect.anything(),
      application.id,
      { folderPath: 'Delivery/Teams', version: '1.0' },
    );
    expect(publishCatalogEntity).not.toHaveBeenCalled();
  });

  it('reports a direct success as a save into the folder', () => {
    const showNotification = vi.fn();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
    render(<CatalogView />);

    captured.current.onPublishSuccess?.(application, ['Delivery'], true);

    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: ResourceSavePanelI18nKeys.SavedToFolder,
      }),
    );
  });
});
