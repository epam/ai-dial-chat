import type { DeploymentConfigurationSchema } from '@epam/ai-dial-chat-shared';
import {
  ListDeploymentsInterfaceTypeEnum,
  type ApplicationSchemaSummaryDto,
  type DeploymentItemDto,
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
import { getApplicationSchemas } from '../server-api/application-schemas';
import { getDeploymentConfiguration } from '../server-api/deployments';
import { getDeployments } from '../server-api/deployments.api';

export interface DeploymentsContextType {
  /** Full list of deployment items from the API, enriched with schema icon fallback. */
  items: DeploymentItemDto[];
  /** ID of the currently selected deployment, or null if none. */
  selectedItemId: string | null;
  /** Updates the selected deployment and persists the choice to localStorage. Use for user-initiated selections. */
  setSelectedItemId: (id: string) => void;
  /**
   * Restores the selected deployment without persisting to localStorage.
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

// TODO: move to user config
const SELECTED_DEPLOYMENT_KEY = 'dial:selectedDeploymentId';

const readStoredDeploymentId = (): string | null => {
  try {
    return localStorage.getItem(SELECTED_DEPLOYMENT_KEY);
  } catch {
    return null;
  }
};

const writeStoredDeploymentId = (id: string): void => {
  try {
    localStorage.setItem(SELECTED_DEPLOYMENT_KEY, id);
  } catch {
    // storage quota exceeded or private browsing — ignore
  }
};

export const DeploymentsProvider = ({ children }: { children: ReactNode }) => {
  const [rawDeployments, setRawDeployments] = useState<DeploymentItemDto[]>([]);
  const [schemas, setSchemas] = useState<ApplicationSchemaSummaryDto[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedDeploymentConfiguration, setSelectedDeploymentConfiguration] =
    useState<DeploymentConfigurationSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDeployments = useCallback(
    async (signal: { isCancelled: boolean }) => {
      setIsLoading(true);
      setError(null);
      setSchemas([]);

      const [deploymentsResult, schemasResult] = await Promise.allSettled([
        getDeployments([ListDeploymentsInterfaceTypeEnum.Chat]),
        getApplicationSchemas(),
      ]);

      if (signal.isCancelled) return;

      if (deploymentsResult.status === 'rejected') {
        const err = deploymentsResult.reason;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        return;
      }

      if (schemasResult.status === 'rejected') {
        console.warn(
          '[DeploymentsContext] Failed to load application schemas; schema icon fallback unavailable.',
          schemasResult.reason,
        );
      } else {
        setSchemas(schemasResult.value.schemas ?? []);
      }

      const deployments = sortDeployments(
        deploymentsResult.value.deployments ?? [],
      );
      setRawDeployments(deployments);
      setSelectedItemId((prev) => {
        if (prev !== null && deployments.some((d) => d.id === prev)) {
          return prev;
        }
        const stored = readStoredDeploymentId();
        if (stored != null && deployments.some((d) => d.id === stored)) {
          return stored;
        }
        return deployments[0]?.id ?? null;
      });
      setIsLoading(false);
    },
    [],
  );

  useEffect(() => {
    const signal = { isCancelled: false };
    loadDeployments(signal);
    return () => {
      signal.isCancelled = true;
    };
  }, [loadDeployments]);

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

  const selectDeployment = useCallback((id: string) => {
    writeStoredDeploymentId(id);
    setSelectedItemId(id);
  }, []);

  const restoreDeployment = useCallback((id: string) => {
    setSelectedItemId(id);
  }, []);

  return (
    <DeploymentsContext.Provider
      value={useMemo(
        () => ({
          items,
          selectedItemId,
          setSelectedItemId: selectDeployment,
          restoreSelectedItemId: restoreDeployment,
          selectedDeploymentConfiguration,
          isLoading,
          error,
        }),
        [
          items,
          selectedItemId,
          selectDeployment,
          restoreDeployment,
          selectedDeploymentConfiguration,
          isLoading,
          error,
        ],
      )}
    >
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
