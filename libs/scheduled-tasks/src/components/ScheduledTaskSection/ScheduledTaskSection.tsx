import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { ScheduledTaskSectionProps } from '../../models/scheduled-task-section-props';

/** Named group of scheduled-task cards (e.g. "Shared", "My tasks") with a title and a count badge. */
export const ScheduledTaskSection: FC<ScheduledTaskSectionProps> = ({
  title,
  count,
  children,
  styles: sectionStyles,
}) => {
  const titleClassName =
    sectionStyles?.titleClassName ?? 'dial-small-semi-text';
  const countBadgeClassName =
    sectionStyles?.countBadgeClassName ?? 'bg-layer-3 text-secondary';

  return (
    <section aria-label={title} className="flex flex-col gap-3">
      {title && (
        <div className="flex items-center gap-2">
          <h2 className={titleClassName}>{title}</h2>
          <span
            className={mergeClasses(
              'dial-tiny-text rounded-full px-2 py-0.5',
              countBadgeClassName,
            )}
          >
            {count}
          </span>
        </div>
      )}
      {children}
    </section>
  );
};
