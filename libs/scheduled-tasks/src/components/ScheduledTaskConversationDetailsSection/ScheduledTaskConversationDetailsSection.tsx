import {
  buildCssVars,
  mergeClasses,
  type MarkdownRendererClassNames,
} from '@epam/ai-dial-chat-shared';
import { Accordion, GhostButton } from '@epam/ai-dial-ui-kit';
import { ReactNode, useEffect, useState, type FC } from 'react';
import type { ScheduledTaskDetailsSummaryStyles } from '../../models/scheduled-task-details-summary-props';
import type { ScheduledTaskInstructionsMarkdownLabels } from '../../models/scheduled-task-instructions';
import { ScheduledTaskDetailsSummary } from '../ScheduledTaskDetailsSummary/ScheduledTaskDetailsSummary';
import { SectionAccordionTitle } from '../SectionAccordionTitle/SectionAccordionTitle';
import styles from './ScheduledTaskConversationDetailsSection.module.scss';

/**
 * Display state of a task conversation's own details, mapped from the host's
 * fetch status by the host adapter.
 */
export enum ScheduledTaskConversationDetailsState {
  /** Details resolved (or still loading); the summary fields render. */
  Ready = 'ready',
  /** Details fetch failed; the section shows the unavailable message with a retry action. */
  Error = 'error',
  /** Details exist but cannot be shown; the section shows the unavailable message without a retry action. */
  Unavailable = 'unavailable',
}

/**
 * Localized labels used by the
 * {@link ScheduledTaskConversationDetailsSection} component.
 */
export interface ScheduledTaskConversationDetailsSectionLabels {
  /** Accordion title, e.g. "Details". */
  title: string;
  /** Label for the model field, e.g. "Model". */
  modelLabel: string;
  /** Label for the instructions field, e.g. "Instructions". */
  instructionsLabel: string;
  /** Label of the optional skill field. */
  skillLabel?: string;
  /** Message shown when the details cannot load (`state` is `Error` or `Unavailable`). */
  unavailableLabel: string;
  /** Label for the retry action shown when `state` is `Error`. */
  retryLabel: string;
}

/** Color overrides for {@link ScheduledTaskConversationDetailsSection}. */
export interface ScheduledTaskConversationDetailsSectionColors {
  /** Text color of the unavailable/error message. Defaults to `--text-secondary`. */
  unavailableText?: string;
}

/** Props for the {@link ScheduledTaskConversationDetailsSection} component. */
export interface ScheduledTaskConversationDetailsSectionProps {
  /** Active schedule id — the expanded state resets whenever it changes. Omit when no schedule is active. */
  scheduleId?: string;
  /** Display state of the details; `Error`/`Unavailable` replace the summary with the scoped unavailable message. */
  state: ScheduledTaskConversationDetailsState;
  /** Called when the user activates the retry action shown while `state` is `Error`. */
  onRetry?: () => void;
  /** Resolved "Model" display value (already resolved to a display name, or the raw id as a fallback). Omit to hide the field. */
  modelDisplayName?: string;
  /** Resolved skill names or full saved references, in selection order; omit or pass [] to hide the field. */
  skillDisplayNames?: string[];
  /** Raw instructions markdown, passed to `renderInstructions` when supplied, or rendered via the default `MDMessageViewer` otherwise. Omit to hide the field entirely. */
  instructionsMarkdown?: string;
  /** Renders `instructionsMarkdown` as a ReactNode. When omitted, `instructionsMarkdown` is rendered via `MDMessageViewer` (the same markdown stack chat assistant messages use). */
  renderInstructions?: (markdown: string) => ReactNode;
  /** Class names forwarded to the summary's built-in instructions `MDMessageViewer`. Defaults to the summary's small 14/20 scale; a supplied map replaces it wholesale. Ignored when `renderInstructions` is supplied. */
  instructionsClassNames?: MarkdownRendererClassNames;
  /** Code-block, table and formula labels for the summary's built-in `MDMessageViewer` renderer. Ignored when `renderInstructions` is supplied. */
  markdownLabels?: ScheduledTaskInstructionsMarkdownLabels;
  /** Style overrides forwarded to the inner `ScheduledTaskDetailsSummary`. */
  summaryStyles?: ScheduledTaskDetailsSummaryStyles;
  /** Localized labels. */
  labels: ScheduledTaskConversationDetailsSectionLabels;
  /** CSS class applied to the accordion title. Defaults to `'dial-tiny-semi-text'`. */
  titleClassName?: string;
  /** Typography class applied to the unavailable/error message. Defaults to `'dial-body-text'`. */
  unavailableTextClassName?: string;
  /** Color overrides, applied as CSS custom properties. */
  colors?: ScheduledTaskConversationDetailsSectionColors;
}

/**
 * Details accordion of a task conversation's sources panel: the run's own
 * Model/Skill/Instructions summary, or the scoped unavailable/retry state
 * while the task's details cannot load. Collapsed by default; resets to
 * collapsed whenever `scheduleId` changes.
 */
export const ScheduledTaskConversationDetailsSection: FC<
  ScheduledTaskConversationDetailsSectionProps
> = ({
  scheduleId,
  state,
  onRetry,
  modelDisplayName,
  skillDisplayNames,
  instructionsMarkdown,
  renderInstructions,
  instructionsClassNames,
  markdownLabels,
  summaryStyles,
  labels,
  titleClassName = 'dial-tiny-semi-text',
  unavailableTextClassName = 'dial-body-text',
  colors,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [scheduleId]);

  const isUnavailable =
    state === ScheduledTaskConversationDetailsState.Error ||
    state === ScheduledTaskConversationDetailsState.Unavailable;

  const content = isUnavailable ? (
    <div className="flex flex-col items-start gap-2">
      <p
        role="status"
        className={mergeClasses(
          unavailableTextClassName,
          styles.unavailableText,
        )}
        style={buildCssVars({
          '--stcd-unavailable-text': colors?.unavailableText,
        })}
      >
        {labels.unavailableLabel}
      </p>
      {state === ScheduledTaskConversationDetailsState.Error && onRetry && (
        <GhostButton label={labels.retryLabel} onClick={onRetry} />
      )}
    </div>
  ) : (
    <ScheduledTaskDetailsSummary
      modelLabel={labels.modelLabel}
      instructionsLabel={labels.instructionsLabel}
      skillLabel={labels.skillLabel}
      skillDisplayNames={skillDisplayNames}
      modelDisplayName={modelDisplayName}
      instructionsMarkdown={instructionsMarkdown}
      renderInstructions={renderInstructions}
      instructionsClassNames={instructionsClassNames}
      markdownLabels={markdownLabels}
      styles={summaryStyles}
    />
  );

  return (
    <Accordion
      title={
        <SectionAccordionTitle className={titleClassName}>
          {labels.title}
        </SectionAccordionTitle>
      }
      expanded={isExpanded}
      onToggle={setIsExpanded}
    >
      {content}
    </Accordion>
  );
};
