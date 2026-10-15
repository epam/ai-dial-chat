import {
  COMPACT_MARKDOWN_CLASS_NAMES,
  MDMessageViewer,
  mergeClasses,
  type MarkdownRendererClassNames,
} from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { ScheduledTaskConfigurationSectionProps } from '../../models/scheduled-task-configuration-section-props';
import styles from './ScheduledTaskConfigurationSection.module.scss';

/*
 * Scoped record, deliberately not a change to the shared presets (which every
 * markdown surface — chat messages, attachment canvas, quotations — consumes):
 * COMPACT gives the instructions the 14px/24px paragraph step, and the
 * ul/ol override keeps list items on that same step, because the renderer's
 * list base classes set no font and <li> would otherwise inherit the ambient
 * font (14/20) while paragraphs render 14/24. Module-level so the memoized
 * MDMessageViewer receives a stable reference.
 */
const INSTRUCTIONS_CLASS_NAMES: MarkdownRendererClassNames = {
  ...COMPACT_MARKDOWN_CLASS_NAMES,
  ul: 'dial-small-paragraph-text mb-3 space-y-1',
  ol: 'dial-small-paragraph-text mb-3 space-y-1',
};

/* Reads the `--stdv-subtitle-text` var the parent ScheduledTaskDetailView
 * sets on its root, so the label color stays overridable through the view's
 * `styles.colors.subtitleText` without this section taking a color prop. */
/** Optional skill and instructions fields; the rendering context owns the section title. */
export const ScheduledTaskConfigurationSection: FC<
  ScheduledTaskConfigurationSectionProps
> = ({
  skillLabel,
  skillDisplayNames,
  instructionsLabel,
  instructionsMarkdown,
  renderInstructions,
  markdownLabels,
  fieldLabelClassName = 'dial-tiny-text',
}) => (
  <div className="flex min-w-0 flex-col gap-5">
    {Boolean(skillDisplayNames?.length) && (
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
        {/* overflow-wrap:anywhere breaks a skill name only when it cannot
         * fit a line by itself; break-all would chop ordinary names at the
         * column edge. */}
        <p className="[overflow-wrap:anywhere] whitespace-normal">
          {skillDisplayNames?.map((name, index) => (
            <span className="block" key={`${index}:${name}`}>
              {name}
            </span>
          ))}
        </p>
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
          <MDMessageViewer
            content={instructionsMarkdown}
            classNames={INSTRUCTIONS_CLASS_NAMES}
            {...markdownLabels}
          />
        )}
      </div>
    )}
  </div>
);
