import {
  Notification,
  NotificationType,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';

export interface Props {
  /** Bold leading title, e.g. "Limited access." */
  title: string;
  /** Normal-weight description following the title on the same line. */
  body: string;
}

/**
 * Non-dismissible error-alert banner shown above the Scheduled Tasks cards
 * when the scheduler service's administrator-managed consent is missing:
 * the user can neither fix nor dismiss it, so it renders the kit error
 * `Notification` as a section message with no action and no close button.
 * The bold title and the description compose into the `message` on one
 * line — the kit stacks its `title` prop above the message, which would
 * render two lines.
 */
const ScheduledTasksLimitedAccessBanner: FC<Props> = ({ title, body }) => (
  <Notification
    variant={NotificationVariant.Error}
    type={NotificationType.SectionMessage}
    message={
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1">
        <span className="dial-small-paragraph-semi-text min-w-0 wrap-break-word">
          {title}
        </span>
        <span className="dial-small-paragraph-text min-w-0 wrap-break-word">
          {body}
        </span>
      </span>
    }
  />
);

export default memo(ScheduledTasksLimitedAccessBanner);
