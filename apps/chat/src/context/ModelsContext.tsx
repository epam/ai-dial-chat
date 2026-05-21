import type { DialModelDto } from '@epam/chat-api-client';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getModels } from '../server-api/models';

export interface ModelsContextType {
  /** List of available models loaded from the API. */
  models: DialModelDto[];
  /** ID of the currently selected model, or null if none selected. */
  selectedModelId: string | null;
  /** Updates the selected model. */
  setSelectedModelId: (modelId: string) => void;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const signal = { cancelled: false };

    setIsLoading(true);
    setError(null);

    getModels()
      .then((response) => {
        if (!signal.cancelled) {
          setModels(response.data);
          setSelectedModelId(response.data[0]?.id ?? null);
        }
      })
      .catch((err: unknown) => {
        if (!signal.cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!signal.cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      signal.cancelled = true;
    };
  }, []);

  return (
    <ModelsContext.Provider
      value={useMemo(
        () => ({
          models,
          selectedModelId,
          setSelectedModelId,
          isLoading,
          error,
        }),
        [models, selectedModelId, isLoading, error],
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
