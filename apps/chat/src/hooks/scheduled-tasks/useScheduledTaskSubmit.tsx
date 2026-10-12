import { ScheduledTaskErrorCode } from '@epam/ai-dial-chat-api-client';
import {
  getApiErrorDetails,
  type ApiErrorDetails,
} from '@epam/ai-dial-chat-hooks';
import type { ScheduledTaskCreateFormErrors } from '@epam/ai-dial-scheduled-tasks';
import {
  Button,
  ButtonAppearance,
  ButtonVariant,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { resolveScheduledTaskErrorMessage } from '../../utils/map-scheduled-task-dto';
import { checkScheduledTaskAuthSessionError } from '../../utils/scheduled-task-auth-error';
import { mapScheduledTaskApiError } from '../../utils/scheduled-task-form-validation';
import type { OfflineCredentialsConnectSettings } from '../offlineCredentials/useOfflineCredentialsGate';
import {
  OfflineCredentialsLoginOutcomeType,
  type OfflineCredentialsLoginOutcome,
} from '../offlineCredentials/useOfflineCredentialsLogin';
import { useScheduledTaskAuthAutoLogin } from './useScheduledTaskAuthAutoLogin';

/** Options the scheduled-task create/edit pages pass into the shared submit flow. */
export interface UseScheduledTaskSubmitOptions<B> {
  /**
   * Re-prepares the body from the form's current values; `null` when validation
   * fails (the page surfaces its own field errors). Re-run for every attempt,
   * so the post-login retry picks up any edit made while the login toast sat
   * open.
   */
  prepare: () => B | null;
  /** Performs the save request; resolves on success, rejects on failure. */
  save: (body: B) => Promise<unknown>;
  /** Runs the normal success path (success toast + navigation). */
  onSuccess: () => void;
  /** Applies server-mapped field errors to the form. */
  onFieldErrors: (errors: ScheduledTaskCreateFormErrors) => void;
  /** i18n key of the generic failure toast shown when no specific branch applies. */
  errorKey: ScheduledTasksI18nKeys;
  /**
   * Optional page-specific error branch, run after the shared field-error
   * mapping and before the shared consent/403 branches; `true` marks the
   * error as fully handled, so no shared branch runs.
   */
  handleExtraError?: (error: unknown, details: ApiErrorDetails) => boolean;
}

export interface UseScheduledTaskSubmitResult {
  /** True while a save or its login-and-retry is in flight — the page freezes its form on this. */
  isSubmitting: boolean;
  /**
   * Runs the save; on a failure attributed to the logged-out external Scheduler
   * auth service, shows the login-required toast whose "Log in and retry"
   * action re-runs the save with the login-retry flag.
   */
  handleSubmit: (isLoginRetry?: boolean) => Promise<void>;
}

/**
 * Shared submit orchestration for the scheduled-task create/edit pages: owns
 * the in-flight state, the save attempt, every failure branch (field errors,
 * the page-specific extra branch, revoked consent, the 403 disambiguation
 * with its login-required toast, and the generic fallback), and the
 * login-and-retry handshake — so the two pages cannot drift in the parts that
 * are identical. Each page supplies only its own pieces: the body
 * preparation, the save request, the success path, the field-error sink, the
 * generic failure key, and (edit only) its not-found branch.
 */
export const useScheduledTaskSubmit = <B,>({
  prepare,
  save,
  onSuccess,
  onFieldErrors,
  errorKey,
  handleExtraError,
}: UseScheduledTaskSubmitOptions<B>): UseScheduledTaskSubmitResult => {
  const { t } = useTranslation();
  const { showErrorNotification, dismissNotification } = useNotification();
  const { autoLogin } = useScheduledTaskAuthAutoLogin();
  const [isSubmitting, setIsSubmitting] = useState(false);

  /*
   * Breaks the circular handshake between the login-required toast's action
   * and the submit pipeline: the toast's action re-enters the submit after a
   * successful login, while the submit itself builds that toast on an
   * attributed 403 — a plain `useCallback` chain cannot reference itself in
   * both directions.
   */
  const submitRef = useRef<
    ((isLoginRetry: boolean) => Promise<void>) | undefined
  >(undefined);

  const showLoginFailedNotification = useCallback(
    (traceId?: string) =>
      showErrorNotification({
        message: t(ScheduledTasksI18nKeys.AutoLoginFailedNotification),
        requestId: traceId,
      }),
    [showErrorNotification, t],
  );

  /**
   * Drives the login-required toast's "Log in and retry" action: dismisses
   * the toast, runs the login while the form stays frozen (`isSubmitting`),
   * and on success re-enters the submit with the login-retry flag — the
   * retried failure keeps the generic error handling (loop guard). A
   * user-cancelled login stays silent; every other failed outcome takes
   * the failed-login toast.
   */
  const handleLoginAndRetry = useCallback(
    async (
      connect: OfflineCredentialsConnectSettings,
      toastId: string,
      traceId?: string,
    ): Promise<void> => {
      dismissNotification(toastId);
      setIsSubmitting(true);
      let outcome: OfflineCredentialsLoginOutcome | undefined;
      try {
        outcome = await autoLogin(connect);
      } catch {
        /* A thrown login flow is a failed login — same toast, no rethrow. */
        outcome = undefined;
      } finally {
        setIsSubmitting(false);
      }
      if (outcome?.type === OfflineCredentialsLoginOutcomeType.Cancelled) {
        return;
      }
      if (outcome?.type !== OfflineCredentialsLoginOutcomeType.Success) {
        showLoginFailedNotification(traceId);
        return;
      }
      await submitRef.current?.(true);
    },
    [autoLogin, dismissNotification, showLoginFailedNotification],
  );

  /**
   * Handles a failed save; every path surfaces its own feedback (field
   * errors, the page's extra branch, or a toast) and resolves void. An
   * attributed failure with usable client settings shows the
   * login-required toast carrying the "Log in and retry" action — the
   * login is user-consented through that click (a fresh user activation,
   * so the OAuth popup opens without a pre-reserved window), and the save
   * is retried only after a successful login. `isLoginRetry` keeps a
   * retried save's failure on the generic path — a login that succeeded
   * but left the grant ineffective must not offer the login toast again.
   */
  const handleSubmitError = useCallback(
    async (error: unknown, isLoginRetry: boolean): Promise<void> => {
      try {
        const details = await getApiErrorDetails(error);
        const { traceId, code } = details;
        const fieldErrors = mapScheduledTaskApiError(code, t);
        if (fieldErrors) {
          onFieldErrors(fieldErrors);
          return;
        }
        if (handleExtraError?.(error, details)) {
          return;
        }

        /*
         * A revoked scheduler consent is fixed by an administrator, not by a
         * login: it short-circuits before the 403 disambiguation below, so a
         * consent revocation is never mistaken for a logged-out auth
         * service and never drives the login.
         */
        if (code === ScheduledTaskErrorCode.ScheduledTaskAdminConsentRequired) {
          showErrorNotification({
            message: resolveScheduledTaskErrorMessage(details, errorKey, t),
            requestId: traceId,
          });
          return;
        }

        /*
         * A bare 403 is either a genuine permission denial or the external
         * Scheduler auth service being logged out (Core returns the same bare
         * status for both). One fresh status check disambiguates (issue
         * #9046); an attributed failure with usable client settings shows
         * the login-required toast whose "Log in and retry" action drives
         * the login, so the page and its unsaved form state stay alive
         * while the OAuth popup runs. An attributed failure with no usable
         * authorize URL, or with no usable settings at all, keeps the
         * generic error handling below.
         */
        const check = await checkScheduledTaskAuthSessionError(error);
        if (
          !isLoginRetry &&
          check.isAuthSessionError &&
          check.connect != null
        ) {
          const { connect } = check;
          /*
           * `toastId` is filled by the `showErrorNotification` call below and
           * read only when the action is clicked, so the closure always sees
           * the assigned value. Dismissed when the action runs, so a
           * completed or failed login-and-retry cannot leave a stale
           * actionable toast behind.
           */
          let toastId = '';
          const action = (
            <Button
              variant={ButtonVariant.Neutral}
              appearance={ButtonAppearance.Outlined}
              size={ElementSize.Small}
              label={t(ScheduledTasksI18nKeys.LoginAndRetryAction)}
              onClick={() =>
                void handleLoginAndRetry(connect, toastId, traceId)
              }
            />
          );
          toastId = showErrorNotification({
            message: t(ScheduledTasksI18nKeys.LoginRequiredNotification),
            requestId: traceId,
            action,
          });
          return;
        }

        showErrorNotification({
          /* DIAL Scheduler's own reason when it sent one; never the BFF's
           * generic English-only `message`. */
          message: resolveScheduledTaskErrorMessage(details, errorKey, t),
          requestId: traceId,
        });
      } catch {
        /* The error handler itself must never surface as an unhandled
           rejection on top of a failed save. */
        showErrorNotification({
          message: t(errorKey),
        });
      }
    },
    [
      handleExtraError,
      handleLoginAndRetry,
      onFieldErrors,
      showErrorNotification,
      t,
      errorKey,
    ],
  );

  /**
   * Prepares the body from the current form values and performs the save; on
   * success the page's success path runs. The `isLoginRetry` flag marks the
   * post-login re-entry from the login toast's action, whose failure keeps
   * the generic error handling.
   */
  const handleSubmit = useCallback(
    async (isLoginRetry = false): Promise<void> => {
      const body = prepare();
      if (body == null) return;

      let isSaved = false;
      setIsSubmitting(true);
      try {
        try {
          await save(body);
          isSaved = true;
        } catch (error) {
          await handleSubmitError(error, isLoginRetry);
        }
        if (isSaved) {
          onSuccess();
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [prepare, save, onSuccess, handleSubmitError],
  );

  /* The ref only re-targets between renders — the toast's action is
   * clickable strictly after commit, so an effect is always early enough. */
  useEffect(() => {
    submitRef.current = handleSubmit;
  }, [handleSubmit]);

  return { isSubmitting, handleSubmit };
};
