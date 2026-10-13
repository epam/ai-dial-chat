import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_KIT_ICON_STROKE,
  Notification,
  NotificationType,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { CONVERSATION_INPUT_CLASS } from '../../constants/public-class-names';
import {
  UsageLimitBannerSeverity,
  type UsageLimitBannerViewProps,
} from '../../models/UsageLimitBanner';

const NOTIFICATION_VARIANTS: Record<
  UsageLimitBannerSeverity,
  NotificationVariant
> = {
  [UsageLimitBannerSeverity.Warning]: NotificationVariant.Warning,
  [UsageLimitBannerSeverity.Reached]: NotificationVariant.Error,
};

/** Usage-limit notice for `aboveInputSlot`: a closable section message with a limit sentence and an optional reset time. */
export const UsageLimitBannerView: FC<UsageLimitBannerViewProps> = ({
  severity,
  limitText,
  reset,
  onClose,
  limitTextClassName = 'dial-body-semi-text',
  resetTextClassName,
  className,
}) => (
  <Notification
    type={NotificationType.SectionMessage}
    variant={NOTIFICATION_VARIANTS[severity]}
    /* Polite, not the kit's assertive default for warning/error: the banner
       reports state on page load and after streaming, not a reply to an
       action, so it must not interrupt the screen reader. */
    role="status"
    closable={onClose != null}
    onClose={onClose}
    iconStroke={DIAL_KIT_ICON_STROKE}
    className={mergeClasses(CONVERSATION_INPUT_CLASS.usageBanner, className)}
    message={
      <>
        <span className={limitTextClassName}>{limitText}</span>
        {reset != null && (
          <>
            {' '}
            {/* The spoken form rides an sr-only sibling because `aria-label`
                is not reliably supported on a `<time>`. */}
            <time
              dateTime={reset.isoValue}
              aria-hidden={reset.ariaLabel != null || undefined}
              className={resetTextClassName}
            >
              {reset.label}
            </time>
            {reset.ariaLabel != null && (
              <span className="sr-only">{reset.ariaLabel}</span>
            )}
          </>
        )}
      </>
    }
  />
);
