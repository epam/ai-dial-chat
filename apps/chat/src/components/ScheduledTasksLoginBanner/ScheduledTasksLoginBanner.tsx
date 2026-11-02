import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  LinkButton,
  LiveRegion,
  LiveRegionElement,
  NotificationSurface,
  WarningMessageNotification,
} from '@epam/ai-dial-ui-kit';
import { IconArrowRight } from '@tabler/icons-react';
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
  /** Transient status announced through the aria-live region — while the banner is visible (e.g. a disconnect success alongside the reappeared banner) and after it hides (e.g. a login success), without any visible banner content. */
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

  const isLoggingIn = state === ScheduledTasksLoginBannerState.LoginInProgress;
  const isRetry = state !== undefined && RETRY_STATES.has(state);
  const retryMessage = retryMessageFor(state, {
    popupBlockedMessage,
    cancelledMessage,
    timeoutMessage,
    failedMessage,
  });

  /*
   * The polite status span sits outside the conditional banner so it stays
   * mounted across every state change (including `undefined`) — a live
   * region that mounts in the same render as its text is announced
   * unreliably.
   *
   * The banner keeps the warning variant's own `role="alert"`: it appears
   * when scheduled tasks newly need a login to keep running, which the user
   * should hear at once rather than after the queue drains.
   */
  return (
    <>
      {state !== undefined && (
        <WarningMessageNotification
          surface={NotificationSurface.Neutral}
          title={title}
          message={body}
          action={
            onLogIn && (
              <LinkButton
                label={resolvePrimaryLabel(state, {
                  loginButtonLabel,
                  retryButtonLabel,
                  loggingInLabel,
                })}
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
                className="min-h-11 min-w-11"
              />
            )
          }
        />
      )}
      <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
        {isRetry ? retryMessage : liveAnnouncement}
      </LiveRegion>
    </>
  );
};

export default memo(ScheduledTasksLoginBanner);
