import type { CatalogCreationPermissionsDto } from '@epam/ai-dial-chat-api-client';
import type { AnnouncementListItem } from '@epam/ai-dial-chat-hooks';
import {
  DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS,
  DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES,
  DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES,
  resolveByteLimit,
  resolveExtensionList,
} from '@epam/ai-dial-chat-hooks/project';
import type {
  ApplicationVisualizerRegistry,
  CustomVisualizer,
} from '@epam/ai-dial-chat-shared';
import {
  createContext,
  FC,
  memo,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getClientConfig } from '../server-api/app-config.api';
import { AuthStatus } from '../types/auth-status';
import { UserConfigStatus } from '../types/user-config-status';
import {
  getCatalogCreationIdentity,
  parseCatalogCreationPermissions,
} from '../utils/catalog-creation';
import { useUser } from './auth/UserContext';

const DEFAULT_TRANSCRIBE_SIZE_LIMIT = 5 * 1024 * 1024;
const DEFAULT_FILE_MANAGER_TABS = ['all', 'my_files', 'shared', 'organization'];
const DEFAULT_PUBLICATION_FILTER_SOURCES = ['title', 'role', 'dial_roles'];
const DEFAULT_MAX_ATTACHMENT_FILE_SIZE_BYTES = 536_870_912;
const DEFAULT_USAGE_LIMITS_WARNING_THRESHOLD_PERCENT = 75;

export interface AppConfigState {
  status: UserConfigStatus;
  features: Record<string, boolean>;
  config: {
    activeEventId: string | null;
    aiTextRefinementAvailable?: boolean;
    appVersion: string;
    asrModelId: string | null;
    transcribeSizeLimitBytes: number;
    defaultDeploymentId: string | null;
    dialCoreExternalUrl: string | null;
    mcpAppSandboxUrl: string | null;
    mcpAppTheme: 'light' | 'dark' | null;
    mcpAppUserAgent: string | null;
    mcpAppHostName: string | null;
    fileManagerTabs: string[];
    overlayEnabled: boolean;
    overlayAllowedOrigins: string[];
    allowedConnectOrigins: string[];
    enabledUiFeatures: string[] | null;
    announcementHtml: string | null;
    announcementTitle: string | null;
    announcementDescription: string | null;
    announcements: AnnouncementListItem[];
    welcomeScreenDescription: string | null;
    footerHtmlMessage: string;
    customVisualizers: CustomVisualizer[];
    applicationVisualizers: ApplicationVisualizerRegistry;
    publicationFilterSources: string[];
    maxAttachmentFileSizeBytes: number;
    /** Percentage of a capped usage limit at which the composer banner appears. */
    usageLimitsWarningThresholdPercent: number;
    /** Operator default for the celebrations switch, used while the user has saved no choice. */
    celebrationsEnabledByDefault: boolean;
    /** Maximum size in bytes of one project context file. */
    projectContextFileMaxBytes: number;
    /** Maximum combined size in bytes of a project's context files (its capacity). */
    projectContextTotalMaxBytes: number;
    /** Lower-case extensions, without a dot, accepted as project context files. */
    projectContextAllowedExtensions: string[];
  };
  metadata?: { resolvedAt: string; cacheTtlSeconds: number };
  /**
   * Readiness of `catalogCreationPermissions`, tracked apart from `status` so a
   * refetch or identity change makes creation unavailable without changing
   * what other config consumers see. Client-only; not part of the response.
   */
  catalogCreationStatus: UserConfigStatus;
  /**
   * The current identity's resolved creation permissions. `null` until a
   * response for that identity is accepted, and after a failed or malformed
   * one — `null` never means unrestricted.
   */
  catalogCreationPermissions: CatalogCreationPermissionsDto | null;
}

/* The identity whose response produced the accepted permissions. */
interface ProviderState extends AppConfigState {
  catalogCreationOwner: string | null;
}

const INITIAL_STATE: ProviderState = {
  status: UserConfigStatus.Loading,
  catalogCreationStatus: UserConfigStatus.Loading,
  catalogCreationPermissions: null,
  catalogCreationOwner: null,
  features: {},
  config: {
    activeEventId: null,
    aiTextRefinementAvailable: false,
    appVersion: '',
    asrModelId: null,
    transcribeSizeLimitBytes: DEFAULT_TRANSCRIBE_SIZE_LIMIT,
    defaultDeploymentId: null,
    dialCoreExternalUrl: null,
    mcpAppSandboxUrl: null,
    mcpAppTheme: null,
    mcpAppUserAgent: null,
    mcpAppHostName: null,
    fileManagerTabs: DEFAULT_FILE_MANAGER_TABS,
    overlayEnabled: false,
    overlayAllowedOrigins: [],
    allowedConnectOrigins: [],
    enabledUiFeatures: null,
    announcementHtml: null,
    announcementTitle: null,
    announcementDescription: null,
    announcements: [],
    welcomeScreenDescription: null,
    footerHtmlMessage: '',
    customVisualizers: [],
    applicationVisualizers: {},
    publicationFilterSources: DEFAULT_PUBLICATION_FILTER_SOURCES,
    maxAttachmentFileSizeBytes: DEFAULT_MAX_ATTACHMENT_FILE_SIZE_BYTES,
    usageLimitsWarningThresholdPercent:
      DEFAULT_USAGE_LIMITS_WARNING_THRESHOLD_PERCENT,
    celebrationsEnabledByDefault: true,
    projectContextFileMaxBytes: DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES,
    projectContextTotalMaxBytes: DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES,
    projectContextAllowedExtensions: DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS,
  },
};

const AppConfigContext = createContext<AppConfigState | undefined>(undefined);

interface Props {
  children: ReactNode;
}

const AppConfigProvider: FC<Props> = ({ children }) => {
  const [state, setState] = useState<ProviderState>(INITIAL_STATE);
  const { status: authStatus, user } = useUser();
  const identity = getCatalogCreationIdentity(user);

  const loadConfig = useCallback(
    async (
      signal: AbortSignal,
      isCancelled: () => boolean,
      requestIdentity: string,
    ) => {
      try {
        const response = await getClientConfig(signal);
        if (isCancelled()) return;
        const catalogCreationPermissions = parseCatalogCreationPermissions(
          response.config?.catalogCreationPermissions,
        );
        setState({
          status: UserConfigStatus.Ready,
          catalogCreationStatus: catalogCreationPermissions
            ? UserConfigStatus.Ready
            : UserConfigStatus.Error,
          catalogCreationPermissions,
          catalogCreationOwner: requestIdentity,
          features: (response.features ?? {}) as Record<string, boolean>,
          config: {
            activeEventId: response.config?.activeEventId ?? null,
            aiTextRefinementAvailable:
              response.config?.aiTextRefinementAvailable ?? false,
            appVersion: response.config?.appVersion ?? '',
            asrModelId: response.config?.asrModelId ?? null,
            transcribeSizeLimitBytes:
              response.config?.transcribeSizeLimitBytes ??
              DEFAULT_TRANSCRIBE_SIZE_LIMIT,
            defaultDeploymentId: response.config?.defaultDeploymentId ?? null,
            dialCoreExternalUrl: response.config?.dialCoreExternalUrl ?? null,
            mcpAppSandboxUrl: response.config?.mcpAppSandboxUrl ?? null,
            mcpAppTheme: response.config?.mcpAppTheme ?? null,
            mcpAppUserAgent: response.config?.mcpAppUserAgent ?? null,
            mcpAppHostName: response.config?.mcpAppHostName ?? null,
            fileManagerTabs:
              response.config?.fileManagerTabs ?? DEFAULT_FILE_MANAGER_TABS,
            overlayEnabled: response.config?.overlayEnabled ?? false,
            overlayAllowedOrigins: response.config?.overlayAllowedOrigins ?? [],
            allowedConnectOrigins: response.config?.allowedConnectOrigins ?? [],
            enabledUiFeatures: response.config?.enabledUiFeatures ?? null,
            announcementHtml: response.config?.announcementHtml ?? null,
            announcementTitle: response.config?.announcementTitle ?? null,
            announcementDescription:
              response.config?.announcementDescription ?? null,
            announcements: Array.isArray(response.config?.announcements)
              ? response.config.announcements
              : [],
            welcomeScreenDescription:
              response.config?.welcomeScreenDescription ?? null,
            footerHtmlMessage: response.config?.footerHtmlMessage ?? '',
            customVisualizers: response.config?.customVisualizers ?? [],
            applicationVisualizers:
              response.config?.applicationVisualizers ?? {},
            publicationFilterSources:
              response.config?.publicationFilterSources ??
              DEFAULT_PUBLICATION_FILTER_SOURCES,
            maxAttachmentFileSizeBytes:
              response.config?.maxAttachmentFileSizeBytes ??
              DEFAULT_MAX_ATTACHMENT_FILE_SIZE_BYTES,
            usageLimitsWarningThresholdPercent:
              response.config?.usageLimitsWarningThresholdPercent ??
              DEFAULT_USAGE_LIMITS_WARNING_THRESHOLD_PERCENT,
            celebrationsEnabledByDefault:
              response.config?.celebrationsEnabledByDefault ?? true,
            projectContextFileMaxBytes: resolveByteLimit(
              response.config?.projectContextFileMaxBytes,
              DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES,
            ),
            projectContextTotalMaxBytes: resolveByteLimit(
              response.config?.projectContextTotalMaxBytes,
              DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES,
            ),
            projectContextAllowedExtensions: resolveExtensionList(
              response.config?.projectContextAllowedExtensions,
              DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS,
            ),
          },
          metadata: response.metadata,
        });
      } catch {
        if (isCancelled()) return;
        setState((prev) => ({
          ...prev,
          status: UserConfigStatus.Error,
          catalogCreationStatus: UserConfigStatus.Error,
          catalogCreationPermissions: null,
          catalogCreationOwner: requestIdentity,
        }));
      }
    },
    [],
  );

  useEffect(() => {
    if (authStatus === AuthStatus.Loading) return;
    /* A reload makes the previous permissions unusable until its own
     * response is accepted; unrelated config keeps its current values. */
    setState((prev) => ({
      ...prev,
      catalogCreationStatus: UserConfigStatus.Loading,
      catalogCreationPermissions: null,
      catalogCreationOwner: null,
    }));
    const controller = new AbortController();
    let cancelled = false;
    void loadConfig(controller.signal, () => cancelled, identity);
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loadConfig, authStatus, identity]);

  /* Rejects permissions owned by another identity during render, so a
   * switched user never sees them — not even before the reload effect runs —
   * and withholds them while authentication itself is being resolved. */
  const value = useMemo<AppConfigState>(() => {
    const { catalogCreationOwner, ...appConfig } = state;
    if (
      catalogCreationOwner === identity &&
      authStatus !== AuthStatus.Loading
    ) {
      return appConfig;
    }
    return {
      ...appConfig,
      catalogCreationStatus: UserConfigStatus.Loading,
      catalogCreationPermissions: null,
    };
  }, [state, identity, authStatus]);

  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  );
};

export default memo(AppConfigProvider);

export const useAppConfig = (): AppConfigState => {
  const ctx = useContext(AppConfigContext);
  if (ctx == null) {
    throw new Error('useAppConfig must be used within AppConfigProvider');
  }
  return ctx;
};

export const useFeatureFlag = (key: string): boolean => {
  const { status, features } = useAppConfig();
  if (status !== UserConfigStatus.Ready) return false;
  return features[key] === true;
};
