import type { ConversationTransferJob } from '@epam/ai-dial-chat-shared';
import type { CSSProperties } from 'react';

/** Labels for every user-visible string in `ImportExportQueue`. */
export interface ImportExportQueueLabels {
  /** Primary label for a job targeting all conversations. */
  allConversationsJobLabel: string;
  /** Returns the accessible name for the dismiss control of an in-progress job. */
  closeJobAriaLabel: (title: string) => string;
  /** Returns the accessible name for the retry control of a failed job. */
  retryJobAriaLabel: (title: string) => string;
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
  /** Breadcrumb and neutral icon color. */
  textSecondary?: string;
  /** Successful-job status icon color. */
  successIcon?: string;
  /** Failed-job status icon color. */
  errorIcon?: string;
  /** Failed-job count badge background. */
  failureCountBackground?: string;
  /** Failed-job count badge text. */
  failureCountText?: string;
}

/** Typography class overrides for `ImportExportQueue`. */
export interface ImportExportQueueTypography {
  /** Class applied to the queue heading. */
  titleClassName?: string;
  /** Class applied to a job label. */
  jobLabelClassName?: string;
  /** Class applied to a job source breadcrumb. */
  jobDescriptionClassName?: string;
  /** Class applied to the failed-job count badge. */
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
  /** Queue panel heading (e.g. `"Exporting"`). */
  title: string;
  /** Current list of transfer jobs. */
  jobs: ConversationTransferJob[];
  /** Called when the queue should close (after confirmation if needed). */
  onClose: () => void;
  /** Called with the job id when the user dismisses an in-progress job. */
  onDismiss: (jobId: string) => void;
  /** Called with the job id when the user retries a failed job. */
  onRetry: (jobId: string) => void;
  /** User-visible string labels. */
  labels: ImportExportQueueLabels;
  /** Color, typography, class, and CSS-variable overrides. */
  styles?: ImportExportQueueStyles;
}
