import {
  ListDeploymentsInterfaceTypeEnum,
  type ApplicationSchemaSummaryDto,
  type DeploymentItemDto,
  type DialToolsetDto,
} from '@epam/ai-dial-chat-api-client';
import type { DeploymentConfigurationSchema } from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DeploymentSelectorI18nKeys } from '../constants/translation-keys';
import { useLanguage } from '../hooks/language/useLanguage';
import { getApiErrorDetails } from '../server-api/api-error';
import { getApplicationSchemas } from '../server-api/application-schemas';
import { getDeploymentConfiguration } from '../server-api/deployments';
import { getDeployments } from '../server-api/deployments.api';
import { listToolsets } from '../server-api/toolsets';
import { findDeploymentByIdOrReference } from '../utils/deployment-id';
import { resolveLocalizedText } from '../utils/locale';
import { useAppConfig } from './AppConfigContext';
import { useUser } from './auth/UserContext';
import { useNotification } from './NotificationContext';
import { useUserConfig } from './UserConfigContext';

export interface DeploymentsContextType {
  /** Full list of deployment items from the API, enriched with schema icon fallback. */
  items: DeploymentItemDto[];
  /** ID of the currently selected deployment, or null if none. */
  selectedItemId: string | null;
  /** Updates the selected deployment and persists the choice to user config. Use for user-initiated selections. */
  setSelectedItemId: (id: string | null) => void;
  /**
   * Restores the selected deployment without persisting to user config.
   * Use when loading a conversation to reflect its last-used model without
   * overwriting the user's own model preference for new chats.
   */
  restoreSelectedItemId: (id: string) => void;
  /**
   * Re-resolves `selectedItemId` back to the user's own preference (persisted
   * `selectedDeploymentId`, falling back to the operator default, falling
   * back to the first item), ignoring whatever the in-memory `selectedItemId`
   * currently holds. Use when landing on the New Chat screen, so a value left
   * behind by `restoreSelectedItemId` (from having viewed a different
   * conversation) never becomes the next new chat's model. Does not persist.
   */
  restoreDefaultSelection: () => void;
  /** JSON Schema configuration for the currently selected deployment, or null if none selected or unsupported. */
  selectedDeploymentConfiguration: DeploymentConfigurationSchema | null;
  /** True while deployments are being fetched. */
  isLoading: boolean;
  /** Non-null if the deployments fetch failed. */
  error: Error | null;
  /** List of application type schemas fetched in parallel with deployments. Empty when the fetch failed. */
  schemas: ApplicationSchemaSummaryDto[];
  /** Toolsets fetched from the dedicated toolsets API for catalog surfaces. */
  toolsets: DialToolsetDto[];
  /** Re-fetches toolsets from the API and updates the catalog list. Call after creating/updating a toolset. */
  refetchToolsets: () => Promise<void>;
  /**
   * Re-fetches deployments from the API and updates the catalog list. Call
   * after creating/deleting an application.
   * @param refresh Bypasses the 30s server-side cache when true (default).
   * Pass `false` for a refetch that only needs to reflect a mutation the
   * backend already invalidated its own cache for (e.g. after this app's own
   * PATCH endpoint ran), or for a best-effort intermediate refresh where
   * brief staleness is acceptable because a later refetch will correct it.
   */
  refetchDeployments: (refresh?: boolean) => Promise<void>;
  /**
   * Synchronously upserts a single deployment or toolset into local state,
   * without issuing any request. Use right after accepting a share
   * invitation so the shared item is immediately visible — waiting on
   * `refetchDeployments`/`refetchToolsets` to reflect a just-granted share
   * would race DIAL Core's own propagation of that grant.
   */
  mergeSharedItem: (item: DeploymentItemDto | DialToolsetDto) => void;
}

const isDialToolsetDto = (
  item: DeploymentItemDto | DialToolsetDto,
): item is DialToolsetDto => 'toolset' in item;

export const DeploymentsContext = createContext<
  DeploymentsContextType | undefined
>(undefined);

const sortDeployments = (
  deployments: DeploymentItemDto[],
  activeLocale: string,
): DeploymentItemDto[] => {
  return [...deployments].sort((a, b) => {
    const nameCompare = (
      resolveLocalizedText(a.displayName, activeLocale) || a.id
    ).localeCompare(
      resolveLocalizedText(b.displayName, activeLocale) || b.id,
      undefined,
      { sensitivity: 'accent' },
    );
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return a.id.localeCompare(b.id, undefined, { sensitivity: 'accent' });
  });
};

const sortToolsets = (
  toolsets: DialToolsetDto[],
  activeLocale: string,
): DialToolsetDto[] => {
  return [...toolsets].sort((a, b) => {
    const nameCompare = (
      resolveLocalizedText(a.displayName, activeLocale) || a.id
    ).localeCompare(
      resolveLocalizedText(b.displayName, activeLocale) || b.id,
      undefined,
      { sensitivity: 'accent' },
    );
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return a.id.localeCompare(b.id, undefined, { sensitivity: 'accent' });
  });
};

const resolveInitialSelection = (
  deployments: DeploymentItemDto[],
  inMemoryId: string | null,
  userConfigId: string | null,
  operatorDefaultId: string | null,
): string | null => {
  if (inMemoryId != null && deployments.some((d) => d.id === inMemoryId)) {
    return inMemoryId;
  }
  if (userConfigId != null && deployments.some((d) => d.id === userConfigId)) {
    return userConfigId;
  }
  if (
    operatorDefaultId != null &&
    deployments.some((d) => d.id === operatorDefaultId)
  ) {
    return operatorDefaultId;
  }
  return deployments[0]?.id ?? null;
};

export const DeploymentsProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { showNotification } = useNotification();
  const { selectedDeploymentId: userConfigSelectedId, setSelectedDeployment } =
    useUserConfig();
  const { config: appConfig } = useAppConfig();
  const { user } = useUser();
  const userSub = user?.sub;

  const [rawDeployments, setRawDeployments] = useState<DeploymentItemDto[]>([]);
  const [schemas, setSchemas] = useState<ApplicationSchemaSummaryDto[]>([]);
  const [toolsets, setToolsets] = useState<DialToolsetDto[]>([]);
  const [selectedItemId, setSelectedItemIdState] = useState<string | null>(
    null,
  );
  const [selectedDeploymentConfiguration, setSelectedDeploymentConfiguration] =
    useState<DeploymentConfigurationSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /*
   * The initial fetch (below) and an explicit `refetchDeployments`/
   * `refetchToolsets` call (e.g. right after accepting a share invitation)
   * can be in flight at the same time. Without sequencing, whichever
   * response happens to land last wins — including the stale initial one —
   * so a share-invitation refetch can be silently clobbered by the slower
   * pre-share snapshot. These ids let each setter ignore a response that is
   * no longer the most recently issued request for that resource.
   */
  const deploymentsRequestIdRef = useRef(0);
  const toolsetsRequestIdRef = useRef(0);

  /*
   * loadDeployments only needs userConfigSelectedId/defaultDeploymentId to
   * resolve the *initial* selection on first load. Reading them through refs
   * (instead of as useCallback/useEffect dependencies) keeps loadDeployments
   * stable so picking a new deployment — which optimistically updates
   * userConfigSelectedId via setSelectedDeployment — doesn't re-trigger a
   * full deployments/schemas/toolsets refetch. Without this, isLoading flips
   * true for the whole refetch and the model icon is stuck on a loading
   * skeleton until it resolves.
   */
  const userConfigSelectedIdRef = useRef(userConfigSelectedId);
  const defaultDeploymentIdRef = useRef(appConfig.defaultDeploymentId);
  /*
   * Sorting only needs the active locale at sort time, not as a trigger to
   * re-fetch — read through a ref for the same reason as the refs above.
   */
  const languageRef = useRef(language);

  useEffect(() => {
    languageRef.current = language;
    setRawDeployments((prev) => sortDeployments(prev, language));
    setToolsets((prev) => sortToolsets(prev, language));
  }, [language]);

  useEffect(() => {
    userConfigSelectedIdRef.current = userConfigSelectedId;
  }, [userConfigSelectedId]);

  useEffect(() => {
    defaultDeploymentIdRef.current = appConfig.defaultDeploymentId;
  }, [appConfig.defaultDeploymentId]);

  const loadDeployments = useCallback(
    async (signal: { isCancelled: boolean }) => {
      setIsLoading(true);
      setError(null);
      setRawDeployments([]);
      setSchemas([]);
      setToolsets([]);
      const deploymentsRequestId = ++deploymentsRequestIdRef.current;
      const toolsetsRequestId = ++toolsetsRequestIdRef.current;

      const [deploymentsResult, schemasResult, toolsetsResult] =
        await Promise.allSettled([
          getDeployments([ListDeploymentsInterfaceTypeEnum.Chat]),
          getApplicationSchemas(),
          listToolsets(),
        ]);

      if (signal.isCancelled) return;

      if (schemasResult.status === 'rejected') {
        console.warn(
          '[DeploymentsContext] Failed to load application schemas; schema icon fallback unavailable.',
          schemasResult.reason,
        );
      } else {
        setSchemas(schemasResult.value.schemas ?? []);
      }

      if (
        toolsetsResult.status !== 'rejected' &&
        toolsetsRequestIdRef.current === toolsetsRequestId
      ) {
        setToolsets(
          sortToolsets(toolsetsResult.value.data ?? [], languageRef.current),
        );
      }

      if (deploymentsResult.status === 'rejected') {
        const err = deploymentsResult.reason;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        return;
      }

      if (deploymentsRequestIdRef.current === deploymentsRequestId) {
        const deployments = sortDeployments(
          deploymentsResult.value.deployments ?? [],
          languageRef.current,
        );
        setRawDeployments(deployments);
        setSelectedItemIdState((prev) =>
          resolveInitialSelection(
            deployments,
            prev,
            userConfigSelectedIdRef.current,
            defaultDeploymentIdRef.current,
          ),
        );
      }
      setIsLoading(false);
    },
    [],
  );

  /*
   * userSub is included so that if the authenticated identity changes while
   * this provider stays mounted, the deployments/toolsets snapshot (and its
   * isMy ownership flags computed for the previous identity) is refetched
   * instead of being served indefinitely.
   */
  useEffect(() => {
    const signal = { isCancelled: false };
    loadDeployments(signal);
    return () => {
      signal.isCancelled = true;
    };
  }, [loadDeployments, userSub]);

  /*
   * Handles the case where userConfigSelectedId/defaultDeploymentId only
   * become known *after* the initial load already resolved with no
   * selection (e.g. user config loads slower than deployments) — recomputes
   * the selection against the already-loaded list without refetching.
   */
  useEffect(() => {
    if (selectedItemId != null || rawDeployments.length === 0) return;
    const resolved = resolveInitialSelection(
      rawDeployments,
      null,
      userConfigSelectedId,
      appConfig.defaultDeploymentId,
    );
    if (resolved != null) setSelectedItemIdState(resolved);
  }, [
    userConfigSelectedId,
    appConfig.defaultDeploymentId,
    rawDeployments,
    selectedItemId,
  ]);

  const refetchToolsets = useCallback(async () => {
    const requestId = ++toolsetsRequestIdRef.current;
    try {
      const { data } = await listToolsets();
      if (toolsetsRequestIdRef.current !== requestId) return;
      setToolsets(sortToolsets(data ?? [], languageRef.current));
    } catch (error) {
      if (toolsetsRequestIdRef.current !== requestId) return;
      const { traceId } = await getApiErrorDetails(error);
      showNotification({
        variant: NotificationVariant.Error,
        message: t(DeploymentSelectorI18nKeys.RefetchToolsetsFailed),
        requestId: traceId,
      });
    }
  }, [showNotification, t]);

  const refetchDeployments = useCallback(
    async (refresh = true) => {
      const requestId = ++deploymentsRequestIdRef.current;
      try {
        const { deployments } = await getDeployments(
          [ListDeploymentsInterfaceTypeEnum.Chat],
          refresh,
        );
        if (deploymentsRequestIdRef.current !== requestId) return;
        setRawDeployments(
          sortDeployments(deployments ?? [], languageRef.current),
        );
      } catch (error) {
        if (deploymentsRequestIdRef.current !== requestId) return;
        const { traceId } = await getApiErrorDetails(error);
        showNotification({
          variant: NotificationVariant.Error,
          message: t(DeploymentSelectorI18nKeys.RefetchDeploymentsFailed),
          requestId: traceId,
        });
      }
    },
    [showNotification, t],
  );

  const mergeSharedItem = useCallback(
    (item: DeploymentItemDto | DialToolsetDto) => {
      if (isDialToolsetDto(item)) {
        setToolsets((prev) =>
          sortToolsets(
            [...prev.filter((t) => t.id !== item.id), item],
            languageRef.current,
          ),
        );
        return;
      }
      setRawDeployments((prev) =>
        sortDeployments(
          [...prev.filter((d) => d.id !== item.id), item],
          languageRef.current,
        ),
      );
    },
    [],
  );

  const items = useMemo<DeploymentItemDto[]>(() => {
    if (schemas.length === 0) return rawDeployments;
    const schemaById = new Map(schemas.map((s) => [s.id, s]));
    return rawDeployments.map((item) => {
      if (
        item.type === 'application' &&
        !item.iconUrl &&
        item.applicationTypeSchemaId
      ) {
        const match = schemaById.get(item.applicationTypeSchemaId);
        if (match?.iconUrl) {
          return { ...item, iconUrl: match.iconUrl };
        }
      }
      return item;
    });
  }, [rawDeployments, schemas]);

  const resolvedSelectedDeploymentId = useMemo(
    () =>
      selectedItemId == null
        ? null
        : (findDeploymentByIdOrReference(items, selectedItemId)?.id ??
          selectedItemId),
    [items, selectedItemId],
  );

  useEffect(() => {
    if (!resolvedSelectedDeploymentId) {
      setSelectedDeploymentConfiguration(null);
      return;
    }

    const signal = { isCancelled: false };

    const loadConfiguration = async () => {
      try {
        const configuration = await getDeploymentConfiguration(
          resolvedSelectedDeploymentId,
        );
        if (!signal.isCancelled) {
          setSelectedDeploymentConfiguration(configuration);
        }
      } catch {
        if (!signal.isCancelled) {
          setSelectedDeploymentConfiguration(null);
        }
      }
    };

    loadConfiguration();

    return () => {
      signal.isCancelled = true;
    };
  }, [resolvedSelectedDeploymentId]);

  const setSelectedItemId = useCallback(
    (id: string | null) => {
      setSelectedItemIdState(id);
      void setSelectedDeployment(id).catch((err) => {
        console.warn(
          '[DeploymentsContext] Failed to persist selected deployment',
          err,
        );
      });
    },
    [setSelectedDeployment],
  );

  const restoreSelectedItemId = useCallback((id: string) => {
    setSelectedItemIdState(id);
  }, []);

  const restoreDefaultSelection = useCallback(() => {
    const resolved = resolveInitialSelection(
      items,
      null,
      userConfigSelectedId,
      appConfig.defaultDeploymentId,
    );
    if (resolved != null) setSelectedItemIdState(resolved);
  }, [items, userConfigSelectedId, appConfig.defaultDeploymentId]);

  const contextValue = useMemo(
    () => ({
      items,
      selectedItemId,
      setSelectedItemId,
      restoreSelectedItemId,
      restoreDefaultSelection,
      selectedDeploymentConfiguration,
      isLoading,
      error,
      schemas,
      toolsets,
      refetchToolsets,
      refetchDeployments,
      mergeSharedItem,
    }),
    [
      items,
      selectedItemId,
      setSelectedItemId,
      restoreSelectedItemId,
      restoreDefaultSelection,
      selectedDeploymentConfiguration,
      isLoading,
      error,
      schemas,
      toolsets,
      refetchToolsets,
      refetchDeployments,
      mergeSharedItem,
    ],
  );

  return (
    <DeploymentsContext.Provider value={contextValue}>
      {children}
    </DeploymentsContext.Provider>
  );
};

export const useDeployments = (): DeploymentsContextType => {
  const context = useContext(DeploymentsContext);
  if (!context) {
    throw new Error('useDeployments must be used within a DeploymentsProvider');
  }
  return context;
};
