import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Notification,
  NotificationType,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';

/** User-visible strings of `ScheduledTasksLimitedAccessBanner`. */
export interface ScheduledTasksLimitedAccessBannerLabels {
  /** Bold leading title. Defaults to `'Limited access.'`. */
  title?: string;
  /** Description following the title on the same line. Defaults to `"You can't create or edit tasks. Contact your administrator for more details."`. */
  body?: string;
}

/** Props for `ScheduledTasksLimitedAccessBanner`. */
export interface ScheduledTasksLimitedAccessBannerProps {
  /** User-visible strings, each with an English default. */
  labels?: ScheduledTasksLimitedAccessBannerLabels;
  /** CSS class applied to the title. Defaults to `'dial-small-paragraph-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to the body. Defaults to `'dial-small-paragraph-text'`. */
  bodyClassName?: string;
}

/*
 * The user can neither fix nor dismiss missing administrator consent, so the
 * kit error section message has no action and no close button. Title and body
 * compose into one `message` line — the kit's own `title` would stack above it.
 */
/** Non-dismissible error banner shown while scheduler access is missing. */
export const ScheduledTasksLimitedAccessBanner: FC<ScheduledTasksLimitedAccessBannerProps> =
  memo(
    ({
      labels,
      titleClassName = 'dial-small-paragraph-semi-text',
      bodyClassName = 'dial-small-paragraph-text',
    }) => (
      <Notification
        variant={NotificationVariant.Error}
        type={NotificationType.SectionMessage}
        message={
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-1">
            <span
              className={mergeClasses(
                'min-w-0 wrap-break-word',
                titleClassName,
              )}
            >
              {labels?.title ?? 'Limited access.'}
            </span>
            <span
              className={mergeClasses('min-w-0 wrap-break-word', bodyClassName)}
            >
              {labels?.body ??
                "You can't create or edit tasks. Contact your administrator for more details."}
            </span>
          </span>
        }
      />
    ),
  );
