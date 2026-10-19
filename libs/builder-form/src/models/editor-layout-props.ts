import type { ReactNode } from 'react';

/** Text labels for `EditorLayout`. All strings have English defaults. */
export interface EditorLayoutLabels {
  /** SR-only text announced while `isSaving` is `true`. Defaults to `'Saving'`. */
  savingStatusLabel?: string;
  /** Accessible name of the resize handle between the columns. Defaults to `'Resize columns'`. */
  resizeHandleLabel?: string;
  /** Tooltip of the resize handle. Defaults to `'Drag to resize'`. */
  resizeHandleTooltip?: string;
}

/** Host-controlled resizing of the left column on desktop. */
export interface ResizableLeftColumn {
  /** Current width of the left column in px. */
  width: number;
  /** Called with the clamped width while the user drags, presses a key or double-clicks the handle. */
  onWidthChange: (width: number) => void;
  /** Width restored by a double-click on the handle. Defaults to `400`. */
  defaultWidth?: number;
  /** Smallest width in px. Defaults to `280`. */
  minWidth?: number;
  /** Largest width in px. Defaults to `640`. */
  maxWidth?: number;
}

/** CSS custom property overrides for `EditorLayout`. */
export interface EditorLayoutColors {
  /** Bottom border color of the header row. Defaults to `--stroke-tertiary`. */
  headerBorderColor?: string;
  /** Border color of the dividers between the side columns and the main column (the left sidebar and `rightContent`). Defaults to `--stroke-tertiary`. */
  sidebarBorderColor?: string;
}

/** Style overrides for `EditorLayout`. */
export interface EditorLayoutStyles {
  /** Color token overrides. */
  colors?: EditorLayoutColors;
}

/** Props for `EditorLayout`. */
export interface EditorLayoutProps {
  /** Heading text rendered as `<h1>` in the header row. */
  title: string;
  /** Called when the back-arrow button is clicked. */
  onBack: () => void;
  /** Accessible label for the back-arrow button. Defaults to `'Back'`. */
  backAriaLabel?: string;
  /** Inline-end slot in the header row — typically Cancel + Save buttons. */
  actions?: ReactNode;
  /** Left column content (Metadata section at desktop; top on mobile). */
  leftContent?: ReactNode;
  /** Center column content (Setup section at desktop; bottom on mobile). When absent, left content fills full width. */
  centerContent?: ReactNode;
  /**
   * Host-rendered content in an extra, third column at the inline end, below
   * the header, on desktop; stacked after the other content on mobile/tablet.
   * Rendered verbatim — the host owns its inner spacing and
   * look. Omit for the default two-column layout (`leftContent` and
   * `centerContent`).
   */
  rightContent?: ReactNode;
  /** Makes the left column resizable on desktop. Needs `centerContent`; omit for the fixed 400 px column. */
  resizableLeftColumn?: ResizableLeftColumn;
  /** When `true`, the SR-only saving status region announces `labels.savingStatusLabel`. */
  isSaving?: boolean;
  /** Text labels with English defaults. */
  labels?: EditorLayoutLabels;
  /** Style overrides applied via CSS custom properties. */
  styles?: EditorLayoutStyles;
  /** `dir` attribute forwarded to the root element for explicit direction override. */
  dir?: 'ltr' | 'rtl';
}
