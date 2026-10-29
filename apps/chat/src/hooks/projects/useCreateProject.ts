import type { CreateProjectResponseDto } from '@epam/ai-dial-chat-api-client';
import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createProject,
  type CreateProjectFields,
} from '../../server-api/projects.api';

/** Result of one {@link useCreateProject} `create` call. */
export type CreateProjectOutcome =
  | { isCreated: true; project: CreateProjectResponseDto }
  | {
      isCreated: false;
      /** `true` when the page unmounted mid-request; nothing should be shown. */
      isAborted: boolean;
      status?: number;
      /** The BFF's `ProjectCreateErrorCode`, when the rejection carried one. */
      code?: string;
    };

/**
 * Submits the New project form. The page owns the form state and decides
 * what each outcome means, so this hook only tracks the in-flight state,
 * normalises a failure into `{ status, code }` through the shared
 * `getApiErrorDetails` (the same mapping scheduled tasks use), and aborts the
 * request when the page unmounts, so a late response never updates state.
 */
export const useCreateProject = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const create = useCallback(
    async (
      fields: CreateProjectFields,
      files: File[],
    ): Promise<CreateProjectOutcome> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setIsSubmitting(true);
      try {
        const project = await createProject(fields, files, controller.signal);
        return { isCreated: true, project };
      } catch (error) {
        if (controller.signal.aborted) {
          return { isCreated: false, isAborted: true };
        }
        const { status, code } = await getApiErrorDetails(error);
        return { isCreated: false, isAborted: false, status, code };
      } finally {
        if (!controller.signal.aborted) setIsSubmitting(false);
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [],
  );

  return { create, isSubmitting };
};
