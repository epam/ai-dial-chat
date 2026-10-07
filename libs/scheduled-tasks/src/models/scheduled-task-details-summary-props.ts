import type { ReactNode } from 'react';
import type { ScheduledTaskInstructionsMarkdownLabels } from './scheduled-task-instructions';

/** Typography overrides for the {@link ScheduledTaskDetailsSummary} component. */
export interface ScheduledTaskDetailsSummaryTypography {
  /** CSS class applied to the "Model"/"Instructions" field labels. Defaults to `'dial-tiny-text'`. */
  fieldLabelClassName?: string;
  /** CSS class applied to the resolved model value. Defaults to `'dial-body-text'`. */
  fieldValueClassName?: string;
}

/** Style overrides for the {@link ScheduledTaskDetailsSummary} component. */
export interface ScheduledTaskDetailsSummaryStyles {
  /** Typography class overrides. */
  typography?: ScheduledTaskDetailsSummaryTypography;
}

/** Props for the {@link ScheduledTaskDetailsSummary} component. */
export interface ScheduledTaskDetailsSummaryProps {
  /** Localized label of the optional skill field. */
  skillLabel?: string;
  /** Resolved skill names or full saved references, in selection order; omit or pass [] to hide the field. */
  skillDisplayNames?: string[];
  /** Label for the model field, e.g. "Model". */
  modelLabel: string;
  /** Label for the instructions field, e.g. "Instructions". */
  instructionsLabel: string;
  /** Resolved "Model" display value (already resolved to a display name, or the raw id as a fallback). Omit to hide the field. */
  modelDisplayName?: string;
  /** Raw instructions markdown, passed to `renderInstructions` when supplied, or rendered via the default `MDMessageViewer` otherwise. Omit to hide the field entirely. */
  instructionsMarkdown?: string;
  /** Renders `instructionsMarkdown` as a ReactNode. When omitted, `instructionsMarkdown` is rendered via `MDMessageViewer` (the same markdown stack chat assistant messages use). */
  renderInstructions?: (markdown: string) => ReactNode;
  /** Code-block, table and formula labels for the built-in `MDMessageViewer`. Ignored when `renderInstructions` is supplied. */
  markdownLabels?: ScheduledTaskInstructionsMarkdownLabels;
  /** Style overrides. */
  styles?: ScheduledTaskDetailsSummaryStyles;
}
