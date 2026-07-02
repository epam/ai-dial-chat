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
  status: ClientGenerationStatus;
}

export enum ClientGenerationStatus {
  Active = 'active',
  Done = 'done',
}

interface Props {
  children: ReactNode;
}

interface GenerationContextValue {
  startGeneration: (path: string, generationId: string) => AbortController;
  completeGeneration: (path: string, generationId: string) => void;
  getGeneration: (path: string) => GenerationEntry | undefined;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

export const GenerationProvider: FC<Props> = ({ children }) => {
  const registryRef = useRef(new Map<string, GenerationEntry>());

  const startGeneration = useCallback(
    (path: string, generationId: string): AbortController => {
      const existing = registryRef.current.get(path);
      if (existing?.status === ClientGenerationStatus.Active) {
        existing.abortController.abort();
      }
      const abortController = new AbortController();
      registryRef.current.set(path, {
        generationId,
        path,
        abortController,
        status: ClientGenerationStatus.Active,
      });
      return abortController;
    },
    [],
  );

  const completeGeneration = useCallback(
    (path: string, generationId: string): void => {
      const entry = registryRef.current.get(path);
      if (entry?.generationId === generationId) {
        registryRef.current.set(path, {
          ...entry,
          status: ClientGenerationStatus.Done,
        });
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
