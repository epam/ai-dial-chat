import { ApplicationErrorCode } from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useState } from 'react';
import {
  getApiErrorDetails,
  type ApiErrorDetails,
} from '../../api-error/api-error';
import type {
  ApplicationAccessSaveResult,
  UseApplicationAccessSyncOptions,
  UseApplicationAccessSyncResult,
} from '../models';
import {
  ApplicationAccessLoadStatus,
  ApplicationAccessSaveOutcome,
} from '../types';
import { useApplicationAccess } from '../useApplicationAccess/useApplicationAccess';

/**
 * Keeps an application's Access draft in step with its stored list: reads the
 * list once for an edited application, holds the draft, and sends it on
 * request. Both operations are injected, so the hook holds no client; a
 * failed save is classified, never shown.
 * @param options - the application, the load and save operations and their switches
 */
export const useApplicationAccessSync = <TContext = void>({
  isEnabled,
  appId,
  shouldLoad,
  loadStoredList,
  saveList,
}: UseApplicationAccessSyncOptions<TContext>): UseApplicationAccessSyncResult<TContext> => {
  const access = useApplicationAccess();
  const { reset: resetAccess, isDirty, toRequestValue } = access;
  const willLoad = isEnabled && Boolean(appId) && shouldLoad;
  const [status, setStatus] = useState(
    willLoad
      ? ApplicationAccessLoadStatus.Loading
      : ApplicationAccessLoadStatus.Loaded,
  );
  const [hasStoredEntries, setHasStoredEntries] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!willLoad) return;
    let cancelled = false;
    setStatus(ApplicationAccessLoadStatus.Loading);

    const load = async () => {
      try {
        const storedList = await loadStoredList(appId);
        if (cancelled) return;
        resetAccess(storedList);
        setHasStoredEntries(storedList.length > 0);
        setStatus(ApplicationAccessLoadStatus.Loaded);
      } catch {
        if (!cancelled) setStatus(ApplicationAccessLoadStatus.Failed);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // The loader is read when the load starts; a new function identity must not re-read the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, attempt, resetAccess, willLoad]);

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  const save = useCallback(
    async (
      applicationId: string,
      context: TContext,
    ): Promise<ApplicationAccessSaveResult> => {
      const list = toRequestValue();
      if (!isEnabled || !isDirty || list == null) {
        return { outcome: ApplicationAccessSaveOutcome.Unchanged };
      }
      try {
        await saveList(applicationId, list, context);
        resetAccess(list);
        setHasStoredEntries(list.length > 0);
        return { outcome: ApplicationAccessSaveOutcome.Saved };
      } catch (error) {
        let details: ApiErrorDetails = { message: null };
        try {
          details = await getApiErrorDetails(error);
        } catch {
          // An unreadable error body is reported as a failure without a message.
        }
        const { code, message, traceId } = details;
        if (
          code ===
          ApplicationErrorCode.ApplicationResourceDependenciesNotAllowed
        ) {
          return { outcome: ApplicationAccessSaveOutcome.Refused, traceId };
        }
        return {
          outcome: ApplicationAccessSaveOutcome.Failed,
          message,
          traceId,
        };
      }
    },
    [isDirty, isEnabled, resetAccess, saveList, toRequestValue],
  );

  return { access, status, hasStoredEntries, retry, save };
};
