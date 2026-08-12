import { MDMessageViewer } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { ScheduledTaskDetailsSummaryProps } from '../../models/scheduled-task-details-summary-props';

/**
 * Concise Model + Instructions summary for a scheduled task, shared between
 * the full detail page and the conversation sources panel. Holds no state,
 * fetching, or routing — all values and rendering are supplied by the host.
 */
export const ScheduledTaskDetailsSummary: FC<
  ScheduledTaskDetailsSummaryProps
> = ({
  modelLabel,
  instructionsLabel,
  modelDisplayName,
  instructionsMarkdown,
  renderInstructions,
  styles,
}) => {
  const fieldLabelClassName =
    styles?.typography?.fieldLabelClassName ?? 'dial-tiny-text';
  const fieldValueClassName =
    styles?.typography?.fieldValueClassName ?? 'dial-body-text';

  const renderInstructionsContent = (markdown: string) =>
    renderInstructions ? (
      renderInstructions(markdown)
    ) : (
      <MDMessageViewer content={markdown} />
    );

  return (
    <div className="flex flex-col gap-3">
      {modelDisplayName && (
        <div className="flex flex-col gap-2">
          <span className={fieldLabelClassName}>{modelLabel}</span>
          <p className={fieldValueClassName}>{modelDisplayName}</p>
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
