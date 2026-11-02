import {
  createGenerationRegistry,
  type GenerationRegistry,
} from '@epam/ai-dial-chat-hooks/conversation';
import {
  createContext,
  type FC,
  type ReactNode,
  useContext,
  useRef,
  useMemo,
} from 'react';

interface Props {
  children: ReactNode;
}

type GenerationContextValue = GenerationRegistry;

const GenerationContext = createContext<GenerationContextValue | null>(null);

export const GenerationProvider: FC<Props> = ({ children }) => {
  const registryRef = useRef<GenerationRegistry>(createGenerationRegistry());
  const value = useMemo<GenerationRegistry>(
    () => ({
      startGeneration: (path, id) =>
        registryRef.current.startGeneration(path, id),
      completeGeneration: (path, id) =>
        registryRef.current.completeGeneration(path, id),
      getGeneration: (path) => registryRef.current.getGeneration(path),
      hasActiveGeneration: () => registryRef.current.hasActiveGeneration(),
    }),
    [],
  );
  return (
    <GenerationContext.Provider value={value}>
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
