import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  NeutralButton,
  Popup,
  PopupSize,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';

export enum OfflineCredentialsModalState {
  Available = 'shown-available',
  LoginInProgress = 'login-in-progress',
  RetryPopupBlocked = 'retry-popup-blocked',
  RetryCancelled = 'retry-cancelled',
  RetryTimeout = 'retry-timeout',
  RetryFailed = 'retry-failed',
}

/** Retry states — every state other than the two non-retry ones. */
const RETRY_STATES = new Set<OfflineCredentialsModalState>([
  OfflineCredentialsModalState.RetryPopupBlocked,
  OfflineCredentialsModalState.RetryCancelled,
  OfflineCredentialsModalState.RetryTimeout,
  OfflineCredentialsModalState.RetryFailed,
]);

export interface Props {
  /** `undefined` renders nothing — covers the gate's checking/hidden/error states. */
  state: OfflineCredentialsModalState | undefined;
  title: string;
  body: string;
  loginButtonLabel: string;
  dismissButtonLabel: string;
  closeAriaLabel: string;
  retryButtonLabel: string;
  loggingInAriaLabel: string;
  popupBlockedMessage: string;
  cancelledMessage: string;
  timeoutMessage: string;
  failedMessage: string;
  /** Transient status announced through the aria-live region without changing any visible label. */
  liveAnnouncement: string;
  onLogIn: () => void;
  onClose: () => void;
}

const retryMessageFor = (
  state: OfflineCredentialsModalState | undefined,
  props: Pick<
    Props,
    | 'popupBlockedMessage'
    | 'cancelledMessage'
    | 'timeoutMessage'
    | 'failedMessage'
  >,
): string | undefined => {
  switch (state) {
    case OfflineCredentialsModalState.RetryPopupBlocked:
      return props.popupBlockedMessage;
    case OfflineCredentialsModalState.RetryCancelled:
      return props.cancelledMessage;
    case OfflineCredentialsModalState.RetryTimeout:
      return props.timeoutMessage;
    case OfflineCredentialsModalState.RetryFailed:
      return props.failedMessage;
    default:
      return undefined;
  }
};

/**
 * Plain, typed-props modal explaining that logging in is required for
 * Scheduled Tasks to run unattended, and driving the OAuth retry states.
 * Takes no SDK/route/context imports — all state and callbacks are supplied
 * by `ScheduledTasksRouteGate` via `useOfflineCredentialsGate`/
 * `useOfflineCredentialsLogin`, keeping this component `libs/*`-portable in
 * shape even though it currently lives app-local (design.md Decision 8).
 */
const OfflineCredentialsLoginModal: FC<Props> = ({
  state,
  title,
  body,
  loginButtonLabel,
  dismissButtonLabel,
  closeAriaLabel,
  retryButtonLabel,
  loggingInAriaLabel,
  popupBlockedMessage,
  cancelledMessage,
  timeoutMessage,
  failedMessage,
  liveAnnouncement,
  onLogIn,
  onClose,
}) => {
  const handleClose = () => onClose();
  const handleLogIn = () => onLogIn();

  if (state === undefined) {
    return (
      <span role="status" aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </span>
    );
  }

  const isLoggingIn = state === OfflineCredentialsModalState.LoginInProgress;
  const isRetry = RETRY_STATES.has(state);
  const retryMessage = retryMessageFor(state, {
    popupBlockedMessage,
    cancelledMessage,
    timeoutMessage,
    failedMessage,
  });
  const primaryLabel = isRetry ? retryButtonLabel : loginButtonLabel;

  return (
    <Popup
      open
      size={PopupSize.Sm}
      header={title}
      ariaLabel={title}
      closeAriaLabel={closeAriaLabel}
      closeOnOutsideClick={!isLoggingIn}
      onClose={isLoggingIn ? undefined : handleClose}
      footer={
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <NeutralButton
            label={dismissButtonLabel}
            disabled={isLoggingIn}
            onClick={handleClose}
            className={mergeClasses('min-h-11 min-w-11')}
          />
          <PrimaryButton
            label={primaryLabel}
            disabled={isLoggingIn}
            onClick={handleLogIn}
            aria-label={isLoggingIn ? loggingInAriaLabel : primaryLabel}
            className={mergeClasses('min-h-11 min-w-11')}
          />
        </div>
      }
    >
      <div aria-busy={isLoggingIn} className="flex flex-col gap-2 px-6 py-4">
        <p className="dial-small-text text-secondary">{body}</p>
        <span role="status" aria-live="polite" className="sr-only">
          {isRetry ? retryMessage : ''}
        </span>
      </div>
    </Popup>
  );
};

export default memo(OfflineCredentialsLoginModal);
