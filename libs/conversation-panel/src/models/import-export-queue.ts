import type {
  ConversationTransferErrorCode,
  ConversationTransferJob,
  ConversationTransferProgressUnits,
} from '@epam/ai-dial-chat-shared';
import type { CSSProperties } from 'react';

/** Labels for every user-visible string in `ImportExportQueue`. */
export interface ImportExportQueueLabels {
  /** Returns the accessible name for the cancel control of an in-progress job. */
  cancelJobAriaLabel: (fileName: string) => string;
  /** Trailing text shown on a canceled row. */
  canceledLabel: string;
  /** Returns the tooltip text explaining why a job failed. */
  jobErrorMessage: (code: ConversationTransferErrorCode | undefined) => string;
  /** Returns the accessible name for a row's progress indicator. */
  jobProgressAriaLabel: (fileName: string) => string;
  /** Returns the spoken value for a row's progress indicator, e.g. `"3 of 10 attachments"`. */
  jobProgressValueText: (units: ConversationTransferProgressUnits) => string;
  /** Accessible name for the queue collapse toggle when the panel is expanded. */
  collapseQueueAriaLabel: string;
  /** Accessible name for the queue expand toggle when the panel is collapsed. */
  expandQueueAriaLabel: string;
  /** Accessible name for the queue close button. */
  closeQueueAriaLabel: string;
  /** Heading text of the close-confirmation dialog. */
  closeQueueConfirmHeader: string;
  /** Confirmation dialog description when at least one job is InProgress and none are Failed. */
  closeQueueConfirmDescriptionInProgress: string;
  /** Confirmation dialog description when at least one job is Failed and none are InProgress. */
  closeQueueConfirmDescriptionFailed: string;
  /** Confirmation dialog description when there are both InProgress and Failed jobs. */
  closeQueueConfirmDescriptionMixed: string;
  /** Label for the confirmation dialog's confirm button. */
  closeLabel: string;
  /** Label for the confirmation dialog's cancel button. */
  cancelLabel: string;
}

/** Color overrides for `ImportExportQueue`. */
export interface ImportExportQueueColors {
  /** Queue panel background. */
  background?: string;
  /** Heading and job-label text. */
  text?: string;
  /** Neutral icon color and the canceled row's dimmed file name. */
  textSecondary?: string;
  /** Successful-job status icon color. */
  successIcon?: string;
  /** Failed-job status icon color. */
  errorIcon?: string;
  /** Unfilled part of a row's progress ring. */
  progressTrack?: string;
  /** Filled arc of a row's progress ring. */
  progressIndicator?: string;
  /** Divider between the header and the job rows. */
  divider?: string;
  /** Failed-job count badge background. */
  failureCountBackground?: string;
  /** Failed-job count badge text. */
  failureCountText?: string;
}

/** Typography class overrides for `ImportExportQueue`. */
export interface ImportExportQueueTypography {
  /** Class applied to the queue heading. Defaults to `'dial-small-semi-text'`. */
  titleClassName?: string;
  /** Class applied to a job's file name. Defaults to `'dial-small-text'`. */
  jobLabelClassName?: string;
  /** Class applied to the canceled row's trailing label. Defaults to `'dial-small-text'`. */
  canceledLabelClassName?: string;
  /** Class applied to the failed-job count badge. Defaults to `'dial-small-semi-text'`. */
  failureCountClassName?: string;
}

/** Combined style overrides for `ImportExportQueue`. */
export interface ImportExportQueueStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ImportExportQueueColors;
  /** Typography class overrides. */
  typography?: ImportExportQueueTypography;
  /** Extra class name(s) merged onto the queue root. */
  rootClassName?: string;
  /** Extra class name(s) merged onto the scrollable jobs container. */
  bodyClassName?: string;
  /** Arbitrary CSS custom properties applied after typed color overrides. */
  cssVars?: CSSProperties;
}

/** Props accepted by `ImportExportQueue`. */
export interface ImportExportQueueProps {
  /**
   * Queue panel heading, rendered verbatim. The host composes any count into
   * it (e.g. `t(key, { count: jobs.length })`); the component never pluralizes.
   */
  title: string;
  /** Current list of transfer jobs. */
  jobs: ConversationTransferJob[];
  /** Called when the queue should close (after confirmation if needed). */
  onClose: () => void;
  /**
   * Called with the job id when the user cancels an in-progress job. The host
   * is expected to abort the work and leave the job in `jobs` with status
   * `Canceled`.
   */
  onCancel: (jobId: string) => void;
  /** User-visible string labels. */
  labels: ImportExportQueueLabels;
  /** Color, typography, class, and CSS-variable overrides. */
  styles?: ImportExportQueueStyles;
}
