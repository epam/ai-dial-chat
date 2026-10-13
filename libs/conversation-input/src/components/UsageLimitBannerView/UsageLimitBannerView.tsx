import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { CloseButton } from '@epam/ai-dial-ui-kit';
import {
  IconAlertCircleFilled,
  IconAlertTriangleFilled,
} from '@tabler/icons-react';
import type { FC } from 'react';
import { CONVERSATION_INPUT_CLASS } from '../../constants/public-class-names';
import {
  UsageLimitBannerSeverity,
  type UsageLimitBannerViewProps,
} from '../../models/UsageLimitBanner';

/* Same glyphs and colors as the kit `Notification` warning / error variants. */
const SEVERITY_ICONS: Record<
  UsageLimitBannerSeverity,
  { Icon: typeof IconAlertCircleFilled; className: string }
> = {
  [UsageLimitBannerSeverity.Warning]: {
    Icon: IconAlertTriangleFilled,
    className: 'text-warning',
  },
  [UsageLimitBannerSeverity.Reached]: {
    Icon: IconAlertCircleFilled,
    className: 'text-error',
  },
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
  const { Icon, className: iconClassName } = SEVERITY_ICONS[severity];

  /* Markup mirrors the kit `Notification` section message (general variant).
     Polite `status`: the banner reports state on page load and after
     streaming, not a reply to an action, so it must not interrupt. */
  return (
    <div
      role="status"
      className={mergeClasses(
        'relative flex items-center justify-between gap-3 rounded-xl border border-transparent bg-layer-sunken p-3 text-primary',
        CONVERSATION_INPUT_CLASS.usageBanner,
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden="true"
          className={mergeClasses('flex shrink-0', iconClassName)}
        >
          <Icon size={24} />
        </span>
        <div className="flex min-w-0 flex-row flex-wrap items-baseline gap-x-1 break-words text-primary">
          <span className={limitTextClassName}>{limitText}</span>
          {reset != null && (
            <>
              {/* Collapsed by the flex layout (the gap spaces it visually),
                  but keeps the two sentences apart for screen readers. */}{' '}
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
        </div>
      </div>
      {onClose != null && (
        <CloseButton
          className="shrink-0 self-start"
          ariaLabel={closeAriaLabel}
          onClose={() => onClose()}
        />
      )}
    </div>
  );
};
