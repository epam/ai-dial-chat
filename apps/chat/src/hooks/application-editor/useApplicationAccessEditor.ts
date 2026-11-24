import type { DeploymentCreationFormValues } from '@epam/ai-dial-builder-form';
import { ApplicationErrorCode } from '@epam/ai-dial-chat-api-client';
import {
  getApiErrorDetails,
  ResourceSaveError,
  useApplicationAccess,
  type UseApplicationAccessResult,
} from '@epam/ai-dial-chat-hooks';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppsEditorI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import {
  getApplicationResourceDependencies,
  updateApplicationAccess,
} from '../../server-api/applications';
import { ApplicationAccessLoadStatus } from '../../types/application-editor';

interface Params {
  /** Whether the edited kind has the Access section. */
  isEnabled: boolean;
  /** Id of the edited application; empty while a new one is being created. */
  appId: string;
  /** Whether the stored list is read for `appId`; `false` once this session created the application, whose list the editor already holds. */
  shouldLoad: boolean;
  /** Message shown when saving fails for a reason the section has no wording for. */
  failedMessage: string;
}

/** The Access section's draft, its stored-list load and its save step. */
export interface ApplicationAccessEditor {
  /** The draft and its derived state. */
  access: UseApplicationAccessResult;
  /** Where the stored list stands; the section is editable only once `Loaded`. */
  status: ApplicationAccessLoadStatus;
  /** Whether the stored list the editor loaded holds at least one entry. */
  hasStoredEntries: boolean;
  /** Reads the stored list again after a failed read. */
  retry: () => void;
  /**
   * Saves the draft when it differs from the stored list and reports whether
   * the save carries on. Core refusing a non-administrator's change shows a
   * warning, keeps the draft and carries on; any other failure shows its
   * error, keeps the draft and reports `false`.
   */
  save: (
    applicationId: string,
    metadata: DeploymentCreationFormValues,
  ) => Promise<boolean>;
  /**
   * The same step for a save the Save panel runs. Core refusing a
   * non-administrator's change shows the warning, keeps the draft and
   * resolves, so the panel carries on; any other failure rejects with a
   * `ResourceSaveError` carrying the message, which the panel shows inline as
   * a failed save. The draft is kept.
   */
  saveOrThrow: (
    applicationId: string,
    metadata: DeploymentCreationFormValues,
  ) => Promise<void>;
}

/**
 * Loads the stored Access list of an edited application once, holds its draft
 * and saves it in its own step after the definition's save.
 */
export const useApplicationAccessEditor = ({
  isEnabled,
  appId,
  shouldLoad,
  failedMessage,
}: Params): ApplicationAccessEditor => {
  const { t } = useTranslation();
  const { showErrorNotification, showWarningNotification } = useNotification();
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
        const { resourceDependencies } =
          await getApplicationResourceDependencies(appId);
        if (cancelled) return;
        resetAccess(resourceDependencies);
        setHasStoredEntries(resourceDependencies.length > 0);
        setStatus(ApplicationAccessLoadStatus.Loaded);
      } catch {
        if (!cancelled) setStatus(ApplicationAccessLoadStatus.Failed);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [appId, attempt, resetAccess, willLoad]);

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  /*
   * Resolves to `undefined` once the step is done, to `{ isRefused: true }`
   * when Core refuses a non-administrator's change (the draft is kept and the
   * warning is shown here), and to the message of any other failure.
   */
  const runStep = useCallback(
    async (
      applicationId: string,
      metadata: DeploymentCreationFormValues,
    ): Promise<
      | { isRefused?: false; message: string; traceId?: string }
      | { isRefused: true }
      | undefined
    > => {
      const list = toRequestValue();
      if (!isEnabled || !isDirty || list == null) return undefined;
      try {
        await updateApplicationAccess(applicationId, metadata, list);
        resetAccess(list);
        setHasStoredEntries(list.length > 0);
        return undefined;
      } catch (error) {
        let details: Awaited<ReturnType<typeof getApiErrorDetails>> = {
          message: null,
        };
        try {
          details = await getApiErrorDetails(error);
        } catch {
          // An unreadable error body falls back to the generic message.
        }
        const { code, message, traceId } = details;
        if (
          code ===
          ApplicationErrorCode.ApplicationResourceDependenciesNotAllowed
        ) {
          showWarningNotification({
            message: t(AppsEditorI18nKeys.AccessAdminOnlyError),
            requestId: traceId,
          });
          return { isRefused: true };
        }
        return { message: message ?? failedMessage, traceId };
      }
    },
    [
      failedMessage,
      isDirty,
      isEnabled,
      resetAccess,
      showWarningNotification,
      t,
      toRequestValue,
    ],
  );

  const save = useCallback(
    async (
      applicationId: string,
      metadata: DeploymentCreationFormValues,
    ): Promise<boolean> => {
      const failure = await runStep(applicationId, metadata);
      if (failure == null || failure.isRefused) return true;
      showErrorNotification({
        message: failure.message,
        requestId: failure.traceId,
      });
      return false;
    },
    [runStep, showErrorNotification],
  );

  const saveOrThrow = useCallback(
    async (
      applicationId: string,
      metadata: DeploymentCreationFormValues,
    ): Promise<void> => {
      const failure = await runStep(applicationId, metadata);
      if (failure != null && !failure.isRefused) {
        throw new ResourceSaveError(failure.message);
      }
    },
    [runStep],
  );

  return { access, status, hasStoredEntries, retry, save, saveOrThrow };
};
