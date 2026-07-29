import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { ScheduledTaskSectionProps } from '../../models/scheduled-task-section-props';
import moduleStyles from './ScheduledTaskSection.module.scss';

/** Named group of scheduled-task cards (e.g. "Shared", "My tasks") with a title and a count badge. */
export const ScheduledTaskSection: FC<ScheduledTaskSectionProps> = ({
  title,
  count,
  children,
  styles: sectionStyles,
}) => {
  const titleClassName =
    sectionStyles?.typography?.titleClassName ?? 'dial-small-semi-text';
  const countBadgeClassName =
    sectionStyles?.typography?.countBadgeClassName ?? 'dial-tiny-text';
  const cssVars = buildCssVars({
    '--sts-badge-bg': sectionStyles?.colors?.countBadgeBackground,
    '--sts-badge-text': sectionStyles?.colors?.countBadgeText,
  });

  return (
    <section
      {...(title ? { 'aria-label': title } : {})}
      style={cssVars}
      className="flex flex-col gap-3"
    >
      {title && (
        <div className="flex items-center gap-2 rtl:flex-row-reverse">
          <h2 className={titleClassName}>{title}</h2>
          <span
            className={mergeClasses(
              'rounded-full px-2 py-0.5',
              countBadgeClassName,
              moduleStyles.countBadge,
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
