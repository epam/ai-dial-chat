import { MDMessageViewer, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { ScheduledTaskConfigurationSectionProps } from '../../models/scheduled-task-configuration-section-props';
import styles from './ScheduledTaskConfigurationSection.module.scss';

/* Reads the `--stdv-subtitle-text` var the parent ScheduledTaskDetailView
 * sets on its root, so the label color stays overridable through the view's
 * `styles.colors.subtitleText` without this section taking a color prop. */
/** Instructions field: the task's prompt markdown, rendered by `renderInstructions` or the shared markdown viewer; the rendering context owns the section title. */
export const ScheduledTaskConfigurationSection: FC<
  ScheduledTaskConfigurationSectionProps
> = ({
  instructionsLabel,
  instructionsMarkdown,
  renderInstructions,
  fieldLabelClassName = 'dial-tiny-text',
}) => (
  <div
    role="group"
    aria-label={instructionsLabel}
    className="flex flex-col gap-1"
  >
    <span className={mergeClasses(fieldLabelClassName, styles.subtitleText)}>
      {instructionsLabel}
    </span>
    {instructionsMarkdown &&
      (renderInstructions ? (
        renderInstructions(instructionsMarkdown)
      ) : (
        <MDMessageViewer content={instructionsMarkdown} />
      ))}
  </div>
);
