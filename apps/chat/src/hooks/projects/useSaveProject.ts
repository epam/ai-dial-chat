import type { UpdateProjectResponseDto } from '@epam/ai-dial-chat-api-client';
import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type CreateProjectFields,
  updateProject,
} from '../../server-api/projects.api';

/** Result of one {@link useSaveProject} `save` call. */
export type SaveProjectOutcome =
  | { isSaved: true; project: UpdateProjectResponseDto }
  | {
      isSaved: false;
      /** `true` when the page unmounted mid-request; nothing should be shown. */
      isAborted: boolean;
      status?: number;
      /** The BFF's `ProjectCreateErrorCode`, when the rejection carried one. */
      code?: string;
      /** Trace id for the error toast. */
      requestId?: string;
    };

/** What one save sends: the fields, the added files, the dropped stored files and the loaded ETag. */
export interface SaveProjectRequest {
  id: string;
  fields: CreateProjectFields;
  newFiles: File[];
  removedFileNames: string[];
  etag: string;
}

/**
 * Submits the Edit project form as one atomic update. The page owns the
 * draft and decides what each outcome means, so this hook only tracks the
 * in-flight state, normalises a failure into `{ status, code, requestId }`
 * through `getApiErrorDetails`, and aborts the request when the page
 * unmounts, so a late response never updates state — the same contract as
 * `useCreateProject`.
 */
export const useSaveProject = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const save = useCallback(
    async ({
      id,
      fields,
      newFiles,
      removedFileNames,
      etag,
    }: SaveProjectRequest): Promise<SaveProjectOutcome> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setIsSubmitting(true);
      try {
        const project = await updateProject(
          id,
          fields,
          newFiles,
          removedFileNames,
          etag,
          controller.signal,
        );
        return { isSaved: true, project };
      } catch (error) {
        if (controller.signal.aborted) {
          return { isSaved: false, isAborted: true };
        }
        const { status, code, traceId } = await getApiErrorDetails(error);
        return {
          isSaved: false,
          isAborted: false,
          status,
          code,
          requestId: traceId,
        };
      } finally {
        if (!controller.signal.aborted) setIsSubmitting(false);
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [],
  );

  return { save, isSubmitting };
};
