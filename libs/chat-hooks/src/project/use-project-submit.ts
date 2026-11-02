import type {
  CreateProjectResponseDto,
  UpdateProjectResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorDetails } from '../api-error/api-error';
import type {
  ProjectFields,
  ProjectsApiClient,
  ProjectUpdateRequest,
} from './projects-api-client';

/** A rejected create or save, normalised for the page. */
export interface ProjectSubmitFailure {
  /** `true` when the page unmounted mid-request; nothing should be shown. */
  isAborted: boolean;
  /** HTTP status of the rejection. */
  status?: number;
  /** The BFF's `ProjectCreateErrorCode`, when the rejection carried one. */
  code?: string;
  /** Trace id for the error toast. */
  requestId?: string;
}

/** Result of one {@link useCreateProject} `create` call. */
export type CreateProjectOutcome =
  | { isCreated: true; project: CreateProjectResponseDto }
  | ({ isCreated: false } & ProjectSubmitFailure);

/** Result of one {@link useSaveProject} `save` call. */
export type SaveProjectOutcome =
  | { isSaved: true; project: UpdateProjectResponseDto }
  | ({ isSaved: false } & ProjectSubmitFailure);

/*
 * One in-flight submission at a time, aborted on unmount so a late response
 * never updates state; a failure is normalised through `getApiErrorDetails`.
 */
const useAbortableSubmit = <TResult>() => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const run = useCallback(
    async (
      request: (signal: AbortSignal) => Promise<TResult>,
    ): Promise<
      { isOk: true; value: TResult } | ({ isOk: false } & ProjectSubmitFailure)
    > => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setIsSubmitting(true);
      try {
        return { isOk: true, value: await request(controller.signal) };
      } catch (error) {
        if (controller.signal.aborted) return { isOk: false, isAborted: true };
        const { status, code, traceId } = await getApiErrorDetails(error);
        return {
          isOk: false,
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

  return { run, isSubmitting };
};

/**
 * Submits the New project form; the page owns the form state and decides
 * what each outcome means.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`.
 */
export const useCreateProject = (
  client: Pick<ProjectsApiClient, 'createProject'>,
) => {
  const { run, isSubmitting } = useAbortableSubmit<CreateProjectResponseDto>();

  const create = useCallback(
    async (
      fields: ProjectFields,
      files: File[],
    ): Promise<CreateProjectOutcome> => {
      const result = await run((signal) =>
        client.createProject(fields, files, signal),
      );
      if (result.isOk) return { isCreated: true, project: result.value };
      const { isOk: _isOk, ...failure } = result;
      return { isCreated: false, ...failure };
    },
    [client, run],
  );

  return { create, isSubmitting };
};

/**
 * Submits the Edit project form as one atomic update, conditioned on the
 * loaded `contentVersion`; the page owns the draft and decides what each
 * outcome means.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`.
 */
export const useSaveProject = (
  client: Pick<ProjectsApiClient, 'updateProject'>,
) => {
  const { run, isSubmitting } = useAbortableSubmit<UpdateProjectResponseDto>();

  const save = useCallback(
    async (request: ProjectUpdateRequest): Promise<SaveProjectOutcome> => {
      const result = await run((signal) =>
        client.updateProject(request, signal),
      );
      if (result.isOk) return { isSaved: true, project: result.value };
      const { isOk: _isOk, ...failure } = result;
      return { isSaved: false, ...failure };
    },
    [client, run],
  );

  return { save, isSubmitting };
};
