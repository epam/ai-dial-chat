import type { DeploymentConfigurationSchema } from '@epam/ai-dial-chat-shared';
import type { DialModelDto } from '@epam/chat-api-client';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getDeploymentConfiguration } from '../server-api/deployments';
import { getModels } from '../server-api/models';

export interface ModelsContextType {
  /** List of available models loaded from the API. */
  models: DialModelDto[];
  /** ID of the currently selected model, or null if none selected. */
  selectedModelId: string | null;
  /** Updates the selected model. */
  setSelectedModelId: (modelId: string) => void;
  /** JSON Schema configuration for the currently selected deployment, or null if none selected or unsupported. */
  selectedModelConfiguration: DeploymentConfigurationSchema | null;
  /** True while the models list is being fetched. */
  isLoading: boolean;
  /** Non-null if the models fetch failed. */
  error: Error | null;
}

export const ModelsContext = createContext<ModelsContextType | undefined>(
  undefined,
);

export const ModelsProvider = ({ children }: { children: ReactNode }) => {
  const [models, setModels] = useState<DialModelDto[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedModelConfiguration, setSelectedModelConfiguration] =
    useState<DeploymentConfigurationSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const signal = { cancelled: false };

    const loadModels = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getModels();
        if (!signal.cancelled) {
          setModels(response.data);
          setSelectedModelId('statgpt-gtdc');
        }
      } catch (err: unknown) {
        if (!signal.cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!signal.cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadModels();

    return () => {
      signal.cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedModelId) {
      setSelectedModelConfiguration(null);
      return;
    }

    const signal = { cancelled: false };

    const loadConfiguration = async () => {
      try {
        const configuration = await getDeploymentConfiguration(selectedModelId);
        if (!signal.cancelled) {
          setSelectedModelConfiguration(configuration);
        }
      } catch (err: unknown) {
        if (!signal.cancelled) {
          setSelectedModelConfiguration(null);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    loadConfiguration();

    return () => {
      signal.cancelled = true;
    };
  }, [selectedModelId]);

  return (
    <ModelsContext.Provider
      value={useMemo(
        () => ({
          models,
          selectedModelId,
          setSelectedModelId,
          selectedModelConfiguration,
          isLoading,
          error,
        }),
        [models, selectedModelId, selectedModelConfiguration, isLoading, error],
      )}
    >
      {children}
    </ModelsContext.Provider>
  );
};

export const useModels = (): ModelsContextType => {
  const context = useContext(ModelsContext);
  if (!context) {
    throw new Error('useModels must be used within a ModelsProvider');
  }
  return context;
};
