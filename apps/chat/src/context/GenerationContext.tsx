import {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
} from 'react';

interface GenerationEntry {
  generationId: string;
  path: string;
  abortController: AbortController;
  status: 'active' | 'done' | 'error';
}

interface Props {
  children: ReactNode;
}

interface GenerationContextValue {
  startGeneration: (path: string, generationId: string) => AbortController;
  stopGeneration: (path: string, generationId: string) => void;
  completeGeneration: (path: string, generationId: string) => void;
  getGeneration: (path: string) => GenerationEntry | undefined;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

export const GenerationProvider: FC<Props> = ({ children }) => {
  const registryRef = useRef(new Map<string, GenerationEntry>());

  const startGeneration = useCallback(
    (path: string, generationId: string): AbortController => {
      const existing = registryRef.current.get(path);
      if (existing?.status === 'active') {
        existing.abortController.abort();
      }
      const abortController = new AbortController();
      registryRef.current.set(path, {
        generationId,
        path,
        abortController,
        status: 'active',
      });
      return abortController;
    },
    [],
  );

  const stopGeneration = useCallback(
    (path: string, generationId: string): void => {
      const entry = registryRef.current.get(path);
      if (entry?.generationId === generationId && entry.status === 'active') {
        entry.abortController.abort();
        registryRef.current.set(path, { ...entry, status: 'error' });
      }
    },
    [],
  );

  const completeGeneration = useCallback(
    (path: string, generationId: string): void => {
      const entry = registryRef.current.get(path);
      if (entry?.generationId === generationId) {
        registryRef.current.set(path, { ...entry, status: 'done' });
      }
    },
    [],
  );

  const getGeneration = useCallback(
    (path: string): GenerationEntry | undefined =>
      registryRef.current.get(path),
    [],
  );

  return (
    <GenerationContext.Provider
      value={{
        startGeneration,
        stopGeneration,
        completeGeneration,
        getGeneration,
      }}
    >
      {children}
    </GenerationContext.Provider>
  );
};

export const useGeneration = (): GenerationContextValue => {
  const ctx = useContext(GenerationContext);
  if (!ctx)
    throw new Error('useGeneration must be used within GenerationProvider');
  return ctx;
};
