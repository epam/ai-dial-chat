import {
  buildCssVars,
  MDMessageViewer,
  mergeClasses,
  type MarkdownRendererClassNames,
} from '@epam/ai-dial-chat-shared';
import { type FC, useMemo } from 'react';
import type { ScheduledTaskDetailsSummaryProps } from '../../models/scheduled-task-details-summary-props';
import styles from './ScheduledTaskDetailsSummary.module.scss';

/*
 * Layout of the built-in Instructions viewer. Its type step comes from
 * `typography.instructionsHeadingClassName` / `instructionsTextClassName`,
 * which default to the small scale (14/20) the summary's other values use —
 * one step down from the default markdown preset (16/26) and the COMPACT
 * preset (14/24).
 */
const INSTRUCTIONS_LAYOUT_CLASS_NAMES: MarkdownRendererClassNames = {
  h1: 'mb-3 mt-6 first:mt-0 [text-wrap:balance]',
  h2: 'mb-2 mt-5 first:mt-0 [text-wrap:balance]',
  h3: 'mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  h4: 'mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  h5: 'mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  h6: 'mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  p: 'mb-3 break-words [overflow-wrap:anywhere] [text-wrap:pretty] last:mb-0',
  ul: 'mb-3 space-y-1',
  ol: 'mb-3 space-y-1',
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
  instructionsLabel,
  modelDisplayName,
  instructionsMarkdown,
  renderInstructions,
  instructionsClassNames,
  markdownLabels,
  styles: styleOverrides,
}) => {
  const fieldLabelClassName = mergeClasses(
    styleOverrides?.typography?.fieldLabelClassName ?? 'dial-tiny-text',
    styles.fieldLabel,
  );
  const fieldValueClassName =
    styleOverrides?.typography?.fieldValueClassName ?? 'dial-small-text';
  const instructionsHeadingClassName =
    styleOverrides?.typography?.instructionsHeadingClassName ??
    'dial-small-semi-text';
  const instructionsTextClassName =
    styleOverrides?.typography?.instructionsTextClassName ?? 'dial-small-text';
  /* Memoized so the memoized `MDMessageViewer` receives a stable reference. */
  const viewerClassNames = useMemo<MarkdownRendererClassNames>(() => {
    const layout = INSTRUCTIONS_LAYOUT_CLASS_NAMES;
    return {
      ...layout,
      h1: mergeClasses(instructionsHeadingClassName, layout.h1),
      h2: mergeClasses(instructionsHeadingClassName, layout.h2),
      h3: mergeClasses(instructionsHeadingClassName, layout.h3),
      h4: mergeClasses(instructionsHeadingClassName, layout.h4),
      h5: mergeClasses(instructionsHeadingClassName, layout.h5),
      h6: mergeClasses(instructionsHeadingClassName, layout.h6),
      p: mergeClasses(instructionsTextClassName, layout.p),
      ul: mergeClasses(instructionsTextClassName, layout.ul),
      ol: mergeClasses(instructionsTextClassName, layout.ol),
      ...instructionsClassNames,
    };
  }, [
    instructionsHeadingClassName,
    instructionsTextClassName,
    instructionsClassNames,
  ]);
  const cssVars = buildCssVars({
    '--stds-field-label': styleOverrides?.colors?.fieldLabel,
  });

  const renderInstructionsContent = (markdown: string) =>
    renderInstructions ? (
      renderInstructions(markdown)
    ) : (
      <MDMessageViewer
        content={markdown}
        classNames={viewerClassNames}
        {...markdownLabels}
      />
    );

  return (
    <div className="flex flex-col gap-3" style={cssVars}>
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
              <span className="block" key={`${index}:${name}`}>
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
