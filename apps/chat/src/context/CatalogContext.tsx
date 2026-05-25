import type { CatalogItemDto } from '@epam/chat-api-client';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getCatalogItems } from '../server-api/catalog';

const CATALOG_FILTER = {
  modelCapabilitiesChatCompletion: true,
  modelCapabilitiesEmbeddings: false,
} as const;

export interface CatalogContextType {
  /** Sorted list of matching catalog items. */
  items: CatalogItemDto[];
  /** ID of the currently selected model or application, or null if none. */
  selectedItemId: string | null;
  /** Updates the selected catalog item. */
  setSelectedItemId: (id: string) => void;
  /** True while the catalog is being fetched. */
  isLoading: boolean;
  /** Non-null if the catalog fetch failed. */
  error: Error | null;
}

export const CatalogContext = createContext<CatalogContextType | undefined>(
  undefined,
);

export const CatalogProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CatalogItemDto[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const signal = { cancelled: false };

    const loadCatalog = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getCatalogItems(CATALOG_FILTER);
        if (!signal.cancelled) {
          setItems(response.data);
          setSelectedItemId(response.data[0]?.id ?? null);
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

    loadCatalog();

    return () => {
      signal.cancelled = true;
    };
  }, []);

  return (
    <CatalogContext.Provider
      value={useMemo(
        () => ({
          items,
          selectedItemId,
          setSelectedItemId,
          isLoading,
          error,
        }),
        [items, selectedItemId, isLoading, error],
      )}
    >
      {children}
    </CatalogContext.Provider>
  );
};

export const useCatalog = (): CatalogContextType => {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
};
