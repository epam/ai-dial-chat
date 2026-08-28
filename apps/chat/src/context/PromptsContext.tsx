import type {
  PromptFolderResponseDto,
  PromptResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { usePromptsState } from '@epam/ai-dial-chat-hooks';
import { createContext, ReactNode, useContext, useMemo } from 'react';
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
  const state = usePromptsState({ listPrompts });

  const contextValue = useMemo<PromptsContextType>(
    () => ({
      prompts: state.prompts,
      folders: state.folders,
      sharedWithMe: state.sharedWithMe,
      publicPrompts: state.publicPrompts,
      publicFolders: state.publicFolders,
      isLoading: state.isLoading,
      error: state.error,
      refetchPrompts: state.refetch,
      refetchPublicPrompts: state.refetchPublicPrompts,
    }),
    [state],
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
