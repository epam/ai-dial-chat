import type { ReactNode } from 'react';
import type { ScheduledTaskInstructionsMarkdownLabels } from './scheduled-task-instructions';

/** Props for the {@link ScheduledTaskConfigurationSection} component. */
export interface ScheduledTaskConfigurationSectionProps {
  /** Localized label of the optional skill field. */
  skillLabel?: string;
  /** Resolved skill names or full saved references, in selection order; omit or pass [] to hide the field. */
  skillDisplayNames?: string[];
  /** Label for the instructions field. */
  instructionsLabel: string;
  /** Raw instructions markdown, passed to `renderInstructions` when supplied, or rendered via `MDMessageViewer` otherwise. Omit to hide the field entirely. */
  instructionsMarkdown?: string;
  /** Renders `instructionsMarkdown` as a ReactNode. When omitted, `instructionsMarkdown` is rendered via `MDMessageViewer` (the same markdown stack chat assistant messages use). */
  renderInstructions?: (markdown: string) => ReactNode;
  /** Code-block, table and formula labels for the built-in `MDMessageViewer`. Ignored when `renderInstructions` is supplied. */
  markdownLabels?: ScheduledTaskInstructionsMarkdownLabels;
  /** CSS class applied to the instructions field label. Defaults to `'dial-tiny-text'`. */
  fieldLabelClassName?: string;
}
