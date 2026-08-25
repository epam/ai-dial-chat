import type {
  PromptFolderResponseDto,
  PromptResponseDto,
} from '@epam/ai-dial-chat-api-client';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { listPrompts } from '../server-api/prompts.api';

export interface PromptsContextType {
  /** The caller's own prompts. */
  prompts: PromptResponseDto[];
  /** Folders in the caller's own prompt namespace. */
  folders: PromptFolderResponseDto[];
  /** Prompts other users have shared with the caller. */
  sharedWithMe: PromptResponseDto[];
  /** Organisation-wide (public) prompts, read-only for every user. */
  publicPrompts: PromptResponseDto[];
  /** Folders in the organisation prompt namespace. */
  publicFolders: PromptFolderResponseDto[];
  /** True until the aggregate prompt listing has settled. */
  isLoading: boolean;
  /** Rejection reason of the most recent failed list request, or `null`. */
  error: unknown;
  /** Re-reads personal, shared-with-me, and organisation prompts. */
  refetchPrompts: () => Promise<void>;
  /** Compatibility alias for the aggregate refetch. */
  refetchPublicPrompts: () => Promise<void>;
}

export const PromptsContext = createContext<PromptsContextType | undefined>(
  undefined,
);

/**
 * Mounted once near the app root so the catalog and the prompt editor read the
 * same prompt and folder state. Every mutation refetches rather than patching:
 * a folder rename rewrites the id of every prompt beneath it and a folder
 * delete removes all descendants, so the backend — not the client — is the
 * authority on prompt paths.
 */
export const PromptsProvider = ({ children }: { children: ReactNode }) => {
  const [prompts, setPrompts] = useState<PromptResponseDto[]>([]);
  const [folders, setFolders] = useState<PromptFolderResponseDto[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<PromptResponseDto[]>([]);
  const [publicPrompts, setPublicPrompts] = useState<PromptResponseDto[]>([]);
  const [publicFolders, setPublicFolders] = useState<PromptFolderResponseDto[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refetchPrompts = useCallback(async () => {
    try {
      const response = await listPrompts();
      setPrompts(response.prompts);
      setFolders(response.folders);
      setSharedWithMe(response.sharedWithMe);
      setPublicPrompts(response.publicPrompts ?? []);
      setPublicFolders(response.publicFolders ?? []);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  const refetchPublicPrompts = refetchPrompts;

  /*
   * The BFF aggregates personal, shared, and organisation prompts, so the
   * browser makes one request and receives one ownership-aware snapshot.
   */
  useEffect(() => {
    const cancelled = { value: false };

    const load = async () => {
      const response = await listPrompts().catch((reason: unknown) => {
        if (!cancelled.value) setError(reason);
        return null;
      });
      if (cancelled.value) return;

      if (response != null) {
        setPrompts(response.prompts);
        setFolders(response.folders);
        setSharedWithMe(response.sharedWithMe);
        setPublicPrompts(response.publicPrompts ?? []);
        setPublicFolders(response.publicFolders ?? []);
        setError(null);
      }

      setIsLoading(false);
    };

    load();

    return () => {
      cancelled.value = true;
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      prompts,
      folders,
      sharedWithMe,
      publicPrompts,
      publicFolders,
      isLoading,
      error,
      refetchPrompts,
      refetchPublicPrompts,
    }),
    [
      prompts,
      folders,
      sharedWithMe,
      publicPrompts,
      publicFolders,
      isLoading,
      error,
      refetchPrompts,
      refetchPublicPrompts,
    ],
  );

  return (
    <PromptsContext.Provider value={contextValue}>
      {children}
    </PromptsContext.Provider>
  );
};

export const usePrompts = (): PromptsContextType => {
  const context = useContext(PromptsContext);
  if (!context) {
    throw new Error('usePrompts must be used within a PromptsProvider');
  }
  return context;
};
