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
  fieldLabelClassName = 'dial-tiny-text',
  fieldValueClassName = 'dial-small-text',
}) => (
  <>
    {description && (
      <div className="flex flex-col gap-1">
        <span
          className={mergeClasses(fieldLabelClassName, styles.subtitleText)}
        >
          {labels.descriptionLabel}
        </span>
        <p className={fieldValueClassName}>{description}</p>
      </div>
    )}

    {modelLabel && (
      <div className="flex flex-col gap-1">
        <span
          className={mergeClasses(fieldLabelClassName, styles.subtitleText)}
        >
          {labels.modelLabel}
        </span>
        <p className={fieldValueClassName}>{modelLabel}</p>
      </div>
    )}

    {repeatsLabel && (
      <div className="flex flex-col gap-1">
        <span
          className={mergeClasses(fieldLabelClassName, styles.subtitleText)}
        >
          {labels.repeatsLabel}
        </span>
        <p className={fieldValueClassName}>{repeatsLabel}</p>
      </div>
    )}

    {activeWindowLabel && (
      <div className="flex flex-col gap-1">
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
