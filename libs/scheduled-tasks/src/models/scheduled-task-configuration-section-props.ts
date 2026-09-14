import type { ReactNode } from 'react';

/** Props for the {@link ScheduledTaskConfigurationSection} component. */
export interface ScheduledTaskConfigurationSectionProps {
  /** Label for the instructions field. */
  instructionsLabel: string;
  /** Raw instructions markdown, passed to `renderInstructions` when supplied, or rendered via `MDMessageViewer` otherwise. Omit to hide the field entirely. */
  instructionsMarkdown?: string;
  /** Renders `instructionsMarkdown` as a ReactNode. When omitted, `instructionsMarkdown` is rendered via `MDMessageViewer` (the same markdown stack chat assistant messages use). */
  renderInstructions?: (markdown: string) => ReactNode;
  /** CSS class applied to the instructions field label. Defaults to `'dial-tiny-text'`. */
  fieldLabelClassName?: string;
}
