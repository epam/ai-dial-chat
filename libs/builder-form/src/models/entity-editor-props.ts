import type { ReactNode } from 'react';
import type { EditorLayoutStyles } from './editor-layout-props';
import type { EditorSectionStyles } from './editor-section-props';

/** Text labels for `EntityEditor`. All strings have English defaults. */
export interface EntityEditorLabels {
  /** Heading of the left section. Defaults to `'Metadata'`. */
  metadataTitle?: string;
  /** Heading of the right section when `setupTitle` is not set. Defaults to `'Setup'`. */
  setupTitle?: string;
  /** Label of the Cancel button. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Accessible name of the back-arrow button. Defaults to `'Back'`. */
  backAriaLabel?: string;
  /** SR-only text announced while submitting. Defaults to `'Saving'`. */
  savingStatusLabel?: string;
}

/** Style overrides for `EntityEditor`. */
export interface EntityEditorStyles {
  /** Overrides forwarded to the inner `EditorLayout`. */
  layout?: EditorLayoutStyles;
  /** Overrides forwarded to both inner `EditorSection`s. */
  section?: EditorSectionStyles;
}

/** Props for `EntityEditor`. */
export interface EntityEditorProps {
  /** Heading text rendered as `<h1>` in the header row. */
  title: string;
  /** Called when the back-arrow button is clicked. */
  onBack: () => void;
  /** Called when the Cancel button is clicked. */
  onCancel: () => void;
  /** Called when the primary button is clicked. */
  onSubmit: () => void;
  /** Label of the primary button, resolved by the host (e.g. Create or Save). */
  submitLabel: string;
  /** Disables Cancel and the primary button and announces the saving status. Defaults to `false`. */
  isSubmitting?: boolean;
  /** Disables the primary button for a host-owned readiness reason, never for validation. Defaults to `false`. */
  isSubmitDisabled?: boolean;
  /** Header actions rendered before Cancel, e.g. a Preview toggle. */
  extraActions?: ReactNode;
  /** Hides Cancel and the primary button so only `extraActions` remain. Defaults to `false`. */
  hideStandardActions?: boolean;
  /** Content of the Metadata section in the left column. */
  metadata: ReactNode;
  /** Extra left-column content rendered below the Metadata section. */
  metadataFooter?: ReactNode;
  /** Content of the Setup section in the right column. When absent, the left column fills the width. */
  setup?: ReactNode;
  /** Heading of the Setup section; overrides `labels.setupTitle`. */
  setupTitle?: string;
  /** Inline error or conflict message, rendered in a `role="alert"` region above the Setup section. */
  alert?: ReactNode;
  /** Class added to the Metadata section root, e.g. an embedding editor's own public class. */
  metadataSectionClassName?: string;
  /** Class added to the Setup section root, e.g. an embedding editor's own public class. */
  setupSectionClassName?: string;
  /** Text labels with English defaults. */
  labels?: EntityEditorLabels;
  /** Style overrides. */
  styles?: EntityEditorStyles;
  /** `dir` attribute forwarded to the layout root for an explicit direction override. */
  dir?: 'ltr' | 'rtl';
}
