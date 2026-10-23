import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { ScheduledTaskDetailsSectionProps } from '../../models/scheduled-task-details-section-props';
import styles from './ScheduledTaskDetailsSection.module.scss';

/*
 * Reads the `--stdv-subtitle-text` var the parent ScheduledTaskDetailView sets
 * on its root, so the field-label color stays overridable through the view's
 * `styles.colors.subtitleText` without the section taking a color prop.
 */
/** Read-only Details field list (description, model/agent, recurrence, activity window); the rendering context owns the section title. */
export const ScheduledTaskDetailsSection: FC<
  ScheduledTaskDetailsSectionProps
> = ({
  labels,
  description,
  modelLabel,
  repeatsLabel,
  activeWindowLabel,
  completedLabel,
  fieldLabelClassName = 'dial-tiny-text',
  fieldValueClassName = 'dial-small-text',
}) => (
  <>
    {/*
     * Every field group carries min-w-0: a flex child's automatic minimum
     * width is its content's min-content width, so without it a long
     * unbreakable description value stretches the column past the viewport
     * instead of letting the value wrap inside it.
     */}
    {description && (
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className={mergeClasses(fieldLabelClassName, styles.subtitleText)}
        >
          {labels.descriptionLabel}
        </span>
        {/* The description is free-form textarea text: pre-wrap keeps the
         * author's line breaks, and overflow-wrap:anywhere breaks long
         * unbroken tokens (URLs and the like) only when a token cannot fit
         * a line by itself — ordinary words still wrap whole, unlike
         * break-all, which chops every word at the column edge. It renders
         * at the same 14px/20px field step as every other value in the
         * section, with its own ink (the theme's primary text — #1b212d
         * when no token is defined — overridable via the view's
         * `styles.colors.descriptionText`). */}
        <p
          className={mergeClasses(
            fieldValueClassName,
            '[overflow-wrap:anywhere] whitespace-pre-wrap',
            styles.description,
          )}
        >
          {description}
        </p>
      </div>
    )}

    {completedLabel && (
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className={mergeClasses(fieldLabelClassName, styles.subtitleText)}
        >
          {labels.completedFieldLabel}
        </span>
        <p className={fieldValueClassName}>{completedLabel}</p>
      </div>
    )}

    {modelLabel && (
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className={mergeClasses(fieldLabelClassName, styles.subtitleText)}
        >
          {labels.modelLabel}
        </span>
        <p className={fieldValueClassName}>{modelLabel}</p>
      </div>
    )}

    {repeatsLabel && (
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className={mergeClasses(fieldLabelClassName, styles.subtitleText)}
        >
          {labels.repeatsLabel}
        </span>
        <p className={fieldValueClassName}>{repeatsLabel}</p>
      </div>
    )}

    {activeWindowLabel && (
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className={mergeClasses(fieldLabelClassName, styles.subtitleText)}
        >
          {labels.activeWindowLabel}
        </span>
        <p className={fieldValueClassName}>{activeWindowLabel}</p>
      </div>
    )}
  </>
);
