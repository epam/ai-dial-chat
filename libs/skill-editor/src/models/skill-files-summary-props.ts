import type { ReactNode } from 'react';

/** Props for `SkillFilesSummary`. */
export interface SkillFilesSummaryProps {
  /** Small caption above the file name, e.g. `'Editing file'`. */
  label: string;
  /** Name of the file being edited; its extension picks the file-type icon. */
  fileName: string;
  /** Whether the file tree is revealed. */
  isExpanded: boolean;
  /** Called with the next expanded state when the summary row is activated. */
  onToggle: (isExpanded: boolean) => void;
  /** Content revealed below the summary row — the Files pane. */
  children: ReactNode;
  /** Typography class applied to the caption. Defaults to `'dial-tiny-lead-text'`. */
  labelClassName?: string;
  /** Typography class applied to the file name. Defaults to `'dial-small-text'`. */
  fileNameClassName?: string;
}
