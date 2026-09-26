import { MDMessageViewer, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { ScheduledTaskConfigurationSectionProps } from '../../models/scheduled-task-configuration-section-props';
import styles from './ScheduledTaskConfigurationSection.module.scss';

/* Reads the `--stdv-subtitle-text` var the parent ScheduledTaskDetailView
 * sets on its root, so the label color stays overridable through the view's
 * `styles.colors.subtitleText` without this section taking a color prop. */
/** Optional skill and instructions fields; the rendering context owns the section title. */
export const ScheduledTaskConfigurationSection: FC<
  ScheduledTaskConfigurationSectionProps
> = ({
  skillLabel,
  skillDisplayName,
  instructionsLabel,
  instructionsMarkdown,
  renderInstructions,
  fieldLabelClassName = 'dial-tiny-text',
}) => (
  <div className="flex min-w-0 flex-col gap-5">
    {skillDisplayName && (
      <div
        role="group"
        aria-label={skillLabel}
        className="flex min-w-0 flex-col gap-1"
      >
        <span
          className={mergeClasses(fieldLabelClassName, styles.subtitleText)}
        >
          {skillLabel}
        </span>
        <p className="whitespace-normal break-all">{skillDisplayName}</p>
      </div>
    )}
    {instructionsMarkdown && (
      <div
        role="group"
        aria-label={instructionsLabel}
        className="flex min-w-0 flex-col gap-1"
      >
        <span
          className={mergeClasses(fieldLabelClassName, styles.subtitleText)}
        >
          {instructionsLabel}
        </span>
        {renderInstructions ? (
          renderInstructions(instructionsMarkdown)
        ) : (
          <MDMessageViewer content={instructionsMarkdown} />
        )}
      </div>
    )}
  </div>
);
