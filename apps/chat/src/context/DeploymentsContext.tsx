import type { DeploymentConfigurationSchema } from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import {
  ListDeploymentsInterfaceTypeEnum,
  type ApplicationSchemaSummaryDto,
  type DeploymentItemDto,
  type DialToolsetDto,
} from '@epam/chat-api-client';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DeploymentSelectorI18nKeys } from '../constants/translation-keys';
import { getApplicationSchemas } from '../server-api/application-schemas';
import { getDeploymentConfiguration } from '../server-api/deployments';
import { getDeployments } from '../server-api/deployments.api';
import { listToolsets } from '../server-api/toolsets';
import { useAppConfig } from './AppConfigContext';
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
  /** Re-fetches deployments from the API and updates the catalog list. Call after creating/deleting an application. */
  refetchDeployments: () => Promise<void>;
}

export const DeploymentsContext = createContext<
  DeploymentsContextType | undefined
>(undefined);

const sortDeployments = (
  deployments: DeploymentItemDto[],
): DeploymentItemDto[] => {
  return [...deployments].sort((a, b) => {
    const nameCompare = (a.displayName ?? a.id).localeCompare(
      b.displayName ?? b.id,
      undefined,
      { sensitivity: 'accent' },
    );
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return a.id.localeCompare(b.id, undefined, { sensitivity: 'accent' });
  });
};

const sortToolsets = (toolsets: DialToolsetDto[]): DialToolsetDto[] => {
  return [...toolsets].sort((a, b) => {
    const nameCompare = (a.displayName ?? a.id).localeCompare(
      b.displayName ?? b.id,
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
  const { showNotification } = useNotification();
  const { selectedDeploymentId: userConfigSelectedId, setSelectedDeployment } =
    useUserConfig();
  const { config: appConfig } = useAppConfig();

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

  const loadDeployments = useCallback(
    async (signal: { isCancelled: boolean }) => {
      setIsLoading(true);
      setError(null);
      setSchemas([]);
      setToolsets([]);

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

      if (toolsetsResult.status !== 'rejected') {
        setToolsets(sortToolsets(toolsetsResult.value.data ?? []));
      }

      if (deploymentsResult.status === 'rejected') {
        const err = deploymentsResult.reason;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        return;
      }

      const deployments = sortDeployments(
        deploymentsResult.value.deployments ?? [],
      );
      setRawDeployments(deployments);
      setSelectedItemIdState((prev) =>
        resolveInitialSelection(
          deployments,
          prev,
          userConfigSelectedId,
          appConfig.defaultDeploymentId,
        ),
      );
      setIsLoading(false);
    },
    [userConfigSelectedId, appConfig.defaultDeploymentId],
  );

  useEffect(() => {
    const signal = { isCancelled: false };
    loadDeployments(signal);
    return () => {
      signal.isCancelled = true;
    };
  }, [loadDeployments]);

  const refetchToolsets = useCallback(async () => {
    try {
      const { data } = await listToolsets();
      setToolsets(sortToolsets(data ?? []));
    } catch {
      showNotification({
        variant: NotificationVariant.Error,
        message: t(DeploymentSelectorI18nKeys.RefetchToolsetsFailed),
      });
    }
  }, [showNotification, t]);

  const refetchDeployments = useCallback(async () => {
    try {
      const { deployments } = await getDeployments([
        ListDeploymentsInterfaceTypeEnum.Chat,
      ]);
      setRawDeployments(sortDeployments(deployments ?? []));
    } catch {
      showNotification({
        variant: NotificationVariant.Error,
        message: t(DeploymentSelectorI18nKeys.RefetchDeploymentsFailed),
      });
    }
  }, [showNotification, t]);

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

  useEffect(() => {
    if (!selectedItemId) {
      setSelectedDeploymentConfiguration(null);
      return;
    }

    const signal = { isCancelled: false };

    const loadConfiguration = async () => {
      try {
        const configuration = await getDeploymentConfiguration(selectedItemId);
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
  }, [selectedItemId]);

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

  const contextValue = useMemo(
    () => ({
      items,
      selectedItemId,
      setSelectedItemId,
      restoreSelectedItemId,
      selectedDeploymentConfiguration,
      isLoading,
      error,
      schemas,
      toolsets,
      refetchToolsets,
      refetchDeployments,
    }),
    [
      items,
      selectedItemId,
      setSelectedItemId,
      restoreSelectedItemId,
      selectedDeploymentConfiguration,
      isLoading,
      error,
      schemas,
      toolsets,
      refetchToolsets,
      refetchDeployments,
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
