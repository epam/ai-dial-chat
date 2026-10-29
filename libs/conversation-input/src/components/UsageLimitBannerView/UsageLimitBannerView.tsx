import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  CloseButton,
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

const SEVERITY_VARIANTS: Record<UsageLimitBannerSeverity, NotificationVariant> =
  {
    [UsageLimitBannerSeverity.Warning]: NotificationVariant.Warning,
    [UsageLimitBannerSeverity.Reached]: NotificationVariant.Error,
  };

/** Usage-limit notice for `aboveInputSlot`: a closable section message with a limit sentence and an optional reset time. */
export const UsageLimitBannerView: FC<UsageLimitBannerViewProps> = ({
  severity,
  limitText,
  reset,
  onClose,
  closeAriaLabel = 'Close notification',
  limitTextClassName = 'dial-small-paragraph-semi-text',
  resetTextClassName = 'dial-small-paragraph-text',
  className,
}) => {
  const limitSentence = <span className={limitTextClassName}>{limitText}</span>;

  /* With a reset, the limit sentence rides the kit `title` slot so the
     section-message layout lays both sentences out on one wrapping row. */
  const resetSentence = reset != null && (
    <>
      {/* Collapsed by the flex layout (the gap spaces it visually), but keeps
          the two sentences apart for screen readers. */}{' '}
      {/* The spoken form rides an sr-only sibling because `aria-label` is not
          reliably supported on a `<time>`. */}
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
  );

  /* Polite `status` overrides the kit's `alert` for warning/error: the banner
     reports state on page load and after streaming, not a reply to an action,
     so it must not interrupt. The sunken fill keeps the neutral section-message
     surface while the variant still tints the glyph. The kit's own close button
     has a fixed English name, so a lib-owned `CloseButton` takes its place. */
  return (
    <Notification
      role="status"
      variant={SEVERITY_VARIANTS[severity]}
      type={NotificationType.SectionMessage}
      title={resetSentence ? limitSentence : undefined}
      message={resetSentence || limitSentence}
      className={mergeClasses(
        'bg-layer-sunken',
        CONVERSATION_INPUT_CLASS.usageBanner,
        className,
      )}
    >
      {onClose != null && (
        <CloseButton
          className="shrink-0 self-start"
          ariaLabel={closeAriaLabel}
          onClose={() => onClose()}
        />
      )}
    </Notification>
  );
};
