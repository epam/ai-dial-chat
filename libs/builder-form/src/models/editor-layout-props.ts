import type { ReactNode } from 'react';

/** Text labels for `EditorLayout`. All strings have English defaults. */
export interface EditorLayoutLabels {
  /** SR-only text announced while `isSaving` is `true`. Defaults to `'Saving'`. */
  savingStatusLabel?: string;
}

/** CSS custom property overrides for `EditorLayout`. */
export interface EditorLayoutColors {
  /** Bottom border color of the header row. Defaults to `--stroke-tertiary`. */
  headerBorderColor?: string;
  /** Inline-end border color of the left sidebar panel. Defaults to `--stroke-tertiary`. */
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
  /** Right column content (Setup section at desktop; bottom on mobile). When absent, left content fills full width. */
  rightContent?: ReactNode;
  /** When `true`, the SR-only saving status region announces `labels.savingStatusLabel`. */
  isSaving?: boolean;
  /** Text labels with English defaults. */
  labels?: EditorLayoutLabels;
  /** Style overrides applied via CSS custom properties. */
  styles?: EditorLayoutStyles;
  /** `dir` attribute forwarded to the root element for explicit direction override. */
  dir?: 'ltr' | 'rtl';
}
