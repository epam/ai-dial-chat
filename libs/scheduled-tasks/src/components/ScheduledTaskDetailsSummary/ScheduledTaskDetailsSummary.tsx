import {
  MDMessageViewer,
  mergeClasses,
  type MarkdownRendererClassNames,
} from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { ScheduledTaskDetailsSummaryProps } from '../../models/scheduled-task-details-summary-props';
import moduleStyles from './ScheduledTaskDetailsSummary.module.scss';

/*
 * The Instructions value is short task prose inside the narrow summary, so
 * its text sits on the small scale (14/20) the summary's other values use —
 * one step down from the default markdown preset (16/26) and the COMPACT
 * preset (14/24). Module-level so the memoized `MDMessageViewer` receives a
 * stable reference.
 */
const INSTRUCTIONS_CLASS_NAMES: MarkdownRendererClassNames = {
  h1: 'dial-small-semi-text mb-3 mt-6 first:mt-0 [text-wrap:balance]',
  h2: 'dial-small-semi-text mb-2 mt-5 first:mt-0 [text-wrap:balance]',
  h3: 'dial-small-semi-text mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  h4: 'dial-small-semi-text mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  h5: 'dial-small-semi-text mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  h6: 'dial-small-semi-text mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  p: 'dial-small-text mb-3 break-words [overflow-wrap:anywhere] [text-wrap:pretty] last:mb-0',
  ul: 'dial-small-text mb-3 space-y-1',
  ol: 'dial-small-text mb-3 space-y-1',
  codeInline: 'mx-0.5 px-1.5 break-words [overflow-wrap:anywhere]',
  blockquote: 'my-4',
  link: 'break-words [overflow-wrap:anywhere]',
  tableWrapper: 'my-4',
  mathBlock: 'my-4',
};

/**
 * Concise Model + Instructions summary for a scheduled task, shared between
 * the full detail page and the conversation sources panel. Holds no state,
 * fetching, or routing — all values and rendering are supplied by the host.
 */
export const ScheduledTaskDetailsSummary: FC<
  ScheduledTaskDetailsSummaryProps
> = ({
  modelLabel,
  skillLabel,
  skillDisplayNames,
  unavailableSkillIndexes,
  instructionsLabel,
  modelDisplayName,
  instructionsMarkdown,
  renderInstructions,
  instructionsClassNames = INSTRUCTIONS_CLASS_NAMES,
  markdownLabels,
  styles,
}) => {
  const fieldLabelClassName =
    styles?.typography?.fieldLabelClassName ?? 'dial-tiny-text text-secondary';
  const fieldValueClassName =
    styles?.typography?.fieldValueClassName ?? 'dial-small-text';

  const renderInstructionsContent = (markdown: string) =>
    renderInstructions ? (
      renderInstructions(markdown)
    ) : (
      <MDMessageViewer
        content={markdown}
        classNames={instructionsClassNames}
        {...markdownLabels}
      />
    );

  return (
    <div className="flex flex-col gap-3">
      {modelDisplayName && (
        <div className="flex flex-col gap-2">
          <span className={fieldLabelClassName}>{modelLabel}</span>
          <p className={fieldValueClassName}>{modelDisplayName}</p>
        </div>
      )}

      {Boolean(skillDisplayNames?.length) && (
        <div className="flex min-w-0 flex-col gap-2">
          <span className={fieldLabelClassName}>{skillLabel}</span>
          <p
            className={mergeClasses(
              fieldValueClassName,
              'break-all whitespace-normal',
            )}
          >
            {skillDisplayNames?.map((name, index) => (
              <span
                className={mergeClasses(
                  'block',
                  unavailableSkillIndexes?.includes(index) &&
                    moduleStyles.unavailableSkill,
                )}
                key={`${index}:${name}`}
              >
                {name}
              </span>
            ))}
          </p>
        </div>
      )}
      {instructionsMarkdown && (
        <div className="flex flex-col gap-2">
          <span className={fieldLabelClassName}>{instructionsLabel}</span>
          {renderInstructionsContent(instructionsMarkdown)}
        </div>
      )}
    </div>
  );
};
