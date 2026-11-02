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

/** User-visible strings of `ScheduledTasksLoginBanner`. */
export interface ScheduledTasksLoginBannerLabels {
  /** Banner title. Defaults to `'Log in required.'`. */
  title?: string;
  /** Banner body. Defaults to `'Scheduled tasks need authorization to run offline.'`. */
  body?: string;
  /** Button label before the first attempt. Defaults to `'Log in'`. */
  logIn?: string;
  /** Button label after a failed attempt. Defaults to `'Retry'`. */
  retry?: string;
  /** Button label, and so its accessible name, while a login runs. Defaults to `'Logging in…'`. */
  loggingIn?: string;
}

/** Props for `ScheduledTasksLoginBanner`. */
export interface ScheduledTasksLoginBannerProps {
  /** Whether the banner is drawn; its live region stays mounted either way. */
  isVisible: boolean;
  /** Whether a login is running; disables the button and shows `labels.loggingIn`. */
  isLoggingIn?: boolean;
  /** Why the last login failed; when set the button reads `labels.retry` and this text is announced. */
  retryMessage?: string;
  /** Status announced when no retry message is set, e.g. a login success after the banner hides. */
  liveAnnouncement?: string;
  /** User-visible strings, each with an English default. */
  labels?: ScheduledTasksLoginBannerLabels;
  /** Starts the login; omitted when no login is possible, which hides the button. */
  onLogIn?: () => void;
}

const resolveButtonLabel = (
  isLoggingIn: boolean,
  retryMessage: string | undefined,
  labels: ScheduledTasksLoginBannerLabels | undefined,
): string => {
  if (isLoggingIn) return labels?.loggingIn ?? 'Logging in…';
  if (retryMessage != null) return labels?.retry ?? 'Retry';
  return labels?.logIn ?? 'Log in';
};

/** Non-dismissible warning banner asking the user to log in so scheduled tasks keep running offline. */
export const ScheduledTasksLoginBanner: FC<ScheduledTasksLoginBannerProps> =
  memo(
    ({
      isVisible,
      isLoggingIn = false,
      retryMessage,
      liveAnnouncement = '',
      labels,
      onLogIn,
    }) => (
      /*
       * The polite status span sits outside the conditional banner so it stays
       * mounted across every state change — a live region that mounts in the
       * same render as its text is announced unreliably. The banner keeps the
       * warning variant's own `role="alert"`: a newly required login should be
       * heard at once.
       */
      <>
        {isVisible && (
          <WarningMessageNotification
            surface={NotificationSurface.Neutral}
            title={labels?.title ?? 'Log in required.'}
            message={
              labels?.body ??
              'Scheduled tasks need authorization to run offline.'
            }
            action={
              onLogIn && (
                <LinkButton
                  label={resolveButtonLabel(isLoggingIn, retryMessage, labels)}
                  disabled={isLoggingIn}
                  iconAfter={
                    <IconArrowRight
                      size={DIAL_ICON_SIZE.SM}
                      stroke={DIAL_KIT_ICON_STROKE}
                      aria-hidden
                      className="rtl:scale-x-[-1]"
                    />
                  }
                  onClick={onLogIn}
                  className="min-h-11 min-w-11"
                />
              )
            }
          />
        )}
        <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
          {retryMessage ?? liveAnnouncement}
        </LiveRegion>
      </>
    ),
  );
