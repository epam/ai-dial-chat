import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  OutlinedButton,
} from '@epam/ai-dial-ui-kit';
import { IconAlertTriangleFilled, IconArrowRight } from '@tabler/icons-react';
import { memo, type FC } from 'react';

export enum ScheduledTasksLoginBannerState {
  Shown = 'shown',
  LoginInProgress = 'login-in-progress',
  RetryPopupBlocked = 'retry-popup-blocked',
  RetryCancelled = 'retry-cancelled',
  RetryTimeout = 'retry-timeout',
  RetryFailed = 'retry-failed',
}

/** Retry states — every state other than `Shown` and `LoginInProgress`. */
const RETRY_STATES = new Set<ScheduledTasksLoginBannerState>([
  ScheduledTasksLoginBannerState.RetryPopupBlocked,
  ScheduledTasksLoginBannerState.RetryCancelled,
  ScheduledTasksLoginBannerState.RetryTimeout,
  ScheduledTasksLoginBannerState.RetryFailed,
]);

export interface Props {
  /** `undefined` renders nothing visible — covers the page's checking/hidden/error gate states. */
  state: ScheduledTasksLoginBannerState | undefined;
  title: string;
  body: string;
  loginButtonLabel: string;
  retryButtonLabel: string;
  /** Shown as the button's own label (and therefore its accessible name) while the login flow is in progress. */
  loggingInLabel: string;
  popupBlockedMessage: string;
  cancelledMessage: string;
  timeoutMessage: string;
  failedMessage: string;
  /** Transient status announced through the aria-live region after the banner hides (e.g. a success confirmation), without any visible banner content. */
  liveAnnouncement: string;
  /** Omitted when Core reports that no offline OAuth client is available. */
  onLogIn?: () => void;
}

const retryMessageFor = (
  state: ScheduledTasksLoginBannerState | undefined,
  props: Pick<
    Props,
    | 'popupBlockedMessage'
    | 'cancelledMessage'
    | 'timeoutMessage'
    | 'failedMessage'
  >,
): string | undefined => {
  switch (state) {
    case ScheduledTasksLoginBannerState.RetryPopupBlocked:
      return props.popupBlockedMessage;
    case ScheduledTasksLoginBannerState.RetryCancelled:
      return props.cancelledMessage;
    case ScheduledTasksLoginBannerState.RetryTimeout:
      return props.timeoutMessage;
    case ScheduledTasksLoginBannerState.RetryFailed:
      return props.failedMessage;
    default:
      return undefined;
  }
};

const resolvePrimaryLabel = (
  state: ScheduledTasksLoginBannerState,
  props: Pick<
    Props,
    'loginButtonLabel' | 'retryButtonLabel' | 'loggingInLabel'
  >,
): string => {
  if (state === ScheduledTasksLoginBannerState.LoginInProgress) {
    return props.loggingInLabel;
  }
  if (RETRY_STATES.has(state)) {
    return props.retryButtonLabel;
  }
  return props.loginButtonLabel;
};

/**
 * Non-blocking, non-dismissible inline banner shown on the Scheduled Tasks
 * list page when offline-credentials login is required. Takes no SDK/route
 * import — all state and callbacks are supplied by `ScheduledTasksPage` via
 * `useOfflineCredentialsGate`/`useOfflineCredentialsLogin`.
 */
const ScheduledTasksLoginBanner: FC<Props> = ({
  state,
  title,
  body,
  loginButtonLabel,
  retryButtonLabel,
  loggingInLabel,
  popupBlockedMessage,
  cancelledMessage,
  timeoutMessage,
  failedMessage,
  liveAnnouncement,
  onLogIn,
}) => {
  const handleLogIn = () => onLogIn?.();

  if (state === undefined) {
    return (
      <span role="status" aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </span>
    );
  }

  const isLoggingIn = state === ScheduledTasksLoginBannerState.LoginInProgress;
  const isRetry = RETRY_STATES.has(state);
  const retryMessage = retryMessageFor(state, {
    popupBlockedMessage,
    cancelledMessage,
    timeoutMessage,
    failedMessage,
  });
  const primaryLabel = resolvePrimaryLabel(state, {
    loginButtonLabel,
    retryButtonLabel,
    loggingInLabel,
  });

  /*
   * Hand-rolled rather than the ui-kit `Notification` component: the design
   * reference pairs a neutral `bg-layer-sunken` surface with a warning
   * triangle icon, a combination `Notification`'s variant system does not
   * expose (each variant ties one fixed icon to one fixed background).
   */
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-layer-sunken p-3"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <IconAlertTriangleFilled
          aria-hidden
          size={DIAL_ICON_SIZE.LG}
          className="shrink-0 text-warning-icon"
        />
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 text-primary">
          <span className="dial-small-paragraph-semi-text min-w-0 break-words">
            {title}
          </span>
          <span className="dial-small-paragraph-text min-w-0 break-words">
            {body}
          </span>
        </div>
      </div>
      {onLogIn && (
        <OutlinedButton
          label={primaryLabel}
          disabled={isLoggingIn}
          iconAfter={
            <IconArrowRight
              size={DIAL_ICON_SIZE.SM}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
              className="rtl:scale-x-[-1]"
            />
          }
          onClick={handleLogIn}
          className="min-h-11 min-w-11 shrink-0"
        />
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {isRetry ? retryMessage : ''}
      </span>
    </div>
  );
};

export default memo(ScheduledTasksLoginBanner);
