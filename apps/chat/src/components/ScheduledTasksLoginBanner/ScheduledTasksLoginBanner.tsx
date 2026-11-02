import { ScheduledTasksLoginBannerState } from '@epam/ai-dial-chat-hooks';
import { ScheduledTasksLoginBanner as LoginBanner } from '@epam/ai-dial-scheduled-tasks';
import { memo, type FC } from 'react';

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

/**
 * Inline banner on the Scheduled Tasks pages when offline-credentials login is
 * required: maps the page's banner state onto the lib banner's visibility,
 * progress and retry message.
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
}) => (
  <LoginBanner
    isVisible={state !== undefined}
    isLoggingIn={state === ScheduledTasksLoginBannerState.LoginInProgress}
    retryMessage={retryMessageFor(state, {
      popupBlockedMessage,
      cancelledMessage,
      timeoutMessage,
      failedMessage,
    })}
    liveAnnouncement={liveAnnouncement}
    labels={{
      title,
      body,
      logIn: loginButtonLabel,
      retry: retryButtonLabel,
      loggingIn: loggingInLabel,
    }}
    onLogIn={onLogIn}
  />
);

export default memo(ScheduledTasksLoginBanner);
