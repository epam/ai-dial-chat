import type { DeploymentConfigurationSchema } from '@epam/ai-dial-chat-shared';
import {
  ListDeploymentsInterfaceTypeEnum,
  type DeploymentItemDto,
} from '@epam/chat-api-client';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getDeploymentConfiguration } from '../server-api/deployments';
import { getDeployments } from '../server-api/deployments.api';

export interface DeploymentsContextType {
  /** Full list of deployment items from the API. */
  items: DeploymentItemDto[];
  /** ID of the currently selected deployment, or null if none. */
  selectedItemId: string | null;
  /** Updates the selected deployment. */
  setSelectedItemId: (id: string) => void;
  /** JSON Schema configuration for the currently selected deployment, or null if none selected or unsupported. */
  selectedDeploymentConfiguration: DeploymentConfigurationSchema | null;
  /** True while deployments are being fetched. */
  isLoading: boolean;
  /** Non-null if the fetch failed. */
  error: Error | null;
}

export const DeploymentsContext = createContext<
  DeploymentsContextType | undefined
>(undefined);

export const DeploymentsProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<DeploymentItemDto[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedDeploymentConfiguration, setSelectedDeploymentConfiguration] =
    useState<DeploymentConfigurationSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const signal = { isCancelled: false };

    const loadDeployments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getDeployments([
          ListDeploymentsInterfaceTypeEnum.Chat,
        ]);
        if (!signal.isCancelled) {
          const deployments = response.deployments ?? [];
          setItems(deployments);
          setSelectedItemId((prev) => {
            if (prev !== null && deployments.some((d) => d.id === prev)) {
              return prev;
            }
            return deployments[0]?.id ?? null;
          });
        }
      } catch (err: unknown) {
        if (!signal.isCancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!signal.isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadDeployments();

    return () => {
      signal.isCancelled = true;
    };
  }, []);

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

  return (
    <DeploymentsContext.Provider
      value={useMemo(
        () => ({
          items,
          selectedItemId,
          setSelectedItemId,
          selectedDeploymentConfiguration,
          isLoading,
          error,
        }),
        [
          items,
          selectedItemId,
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
