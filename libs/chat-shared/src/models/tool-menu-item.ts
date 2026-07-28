import type { ReactNode } from 'react';

/** Resolved tool toggle item rendered in the conversation input tools submenu. */
export interface ToolMenuItem {
  /** Unique tool identifier matching the deployment configuration schema property key. */
  id: string;
  /** Human-readable label displayed next to the tool icon. */
  label: string;
  /** Icon element rendered inline before the label. */
  icon: ReactNode;
  /** Whether the tool is currently toggled on. */
  isSelected: boolean;
}
