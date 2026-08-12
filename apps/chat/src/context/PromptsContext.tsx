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
import { listPrompts, listPublicPrompts } from '../server-api/prompts.api';

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
  /** True until both the personal and organisation list requests have settled. */
  isLoading: boolean;
  /** Rejection reason of the most recent failed list request, or `null`. */
  error: unknown;
  /** Re-reads personal prompts, folders, and shared-with-me prompts. */
  refetchPrompts: () => Promise<void>;
  /** Re-reads organisation prompts and folders. */
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
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  const refetchPublicPrompts = useCallback(async () => {
    try {
      const response = await listPublicPrompts();
      setPublicPrompts(response.prompts);
      setPublicFolders(response.folders);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  /*
   * Both lists load independently: an organisation-bucket outage must not
   * hide the caller's own prompts, and vice versa. `allSettled` also keeps
   * `isLoading` honest — it always reaches false, whatever either call did.
   */
  useEffect(() => {
    const cancelled = { value: false };

    const load = async () => {
      const [personal, organisation] = await Promise.allSettled([
        listPrompts(),
        listPublicPrompts(),
      ]);
      if (cancelled.value) return;

      if (personal.status === 'fulfilled') {
        setPrompts(personal.value.prompts);
        setFolders(personal.value.folders);
        setSharedWithMe(personal.value.sharedWithMe);
      } else {
        setError(personal.reason);
      }

      if (organisation.status === 'fulfilled') {
        setPublicPrompts(organisation.value.prompts);
        setPublicFolders(organisation.value.folders);
      } else {
        setError(organisation.reason);
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
