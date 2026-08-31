import type {
  PromptFolderResponseDto,
  PromptListResponseDto,
  PromptResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** Parameters for {@link usePromptsState}. */
export interface UsePromptsStateParams {
  /** Fetches the aggregate prompt listing from the server. */
  listPrompts: () => Promise<PromptListResponseDto>;
}

/** Result returned by {@link usePromptsState}. */
export interface UsePromptsStateResult {
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
  refetch: () => Promise<void>;
  /** Compatibility alias for the aggregate refetch — same function reference as `refetch`. */
  refetchPublicPrompts: () => Promise<void>;
}

/**
 * Fetches all prompt namespaces (personal, shared, public) with a single
 * aggregate request. Exposes `refetch` / `refetchPublicPrompts` for
 * manual refresh. Does not import any app context, routing, or i18n.
 */
export const usePromptsState = ({
  listPrompts,
}: UsePromptsStateParams): UsePromptsStateResult => {
  const [prompts, setPrompts] = useState<PromptResponseDto[]>([]);
  const [folders, setFolders] = useState<PromptFolderResponseDto[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<PromptResponseDto[]>([]);
  const [publicPrompts, setPublicPrompts] = useState<PromptResponseDto[]>([]);
  const [publicFolders, setPublicFolders] = useState<PromptFolderResponseDto[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refetch = useCallback(async () => {
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
  }, [listPrompts]);

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
  }, [listPrompts]);

  return useMemo(
    () => ({
      prompts,
      folders,
      sharedWithMe,
      publicPrompts,
      publicFolders,
      isLoading,
      error,
      refetch,
      refetchPublicPrompts: refetch,
    }),
    [
      prompts,
      folders,
      sharedWithMe,
      publicPrompts,
      publicFolders,
      isLoading,
      error,
      refetch,
    ],
  );
};
