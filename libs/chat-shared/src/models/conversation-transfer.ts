/** Lifecycle status of a queued export/import job. */
export enum ConversationTransferJobStatus {
  InProgress = 'inProgress',
  Success = 'success',
  Failed = 'failed',
  Canceled = 'canceled',
}

/** Whether a transfer job's subject is a single named conversation or the whole history. */
export enum ConversationTransferSubjectKind {
  Single = 'single',
  All = 'all',
}

/** What a transfer job operates on — structured data, never pre-rendered translated text. */
export type ConversationTransferSubject =
  | {
      kind: ConversationTransferSubjectKind.Single;
      /** The conversation's own name. */
      title: string;
      /** Folder breadcrumb the conversation originated from, if nested. */
      sourceBreadcrumb?: string;
    }
  | { kind: ConversationTransferSubjectKind.All };

/** Reason a transfer job failed. Translation-free; hosts map each member to their own copy. */
export enum ConversationTransferErrorCode {
  Unauthorized = 'unauthorized',
  NotFound = 'notFound',
  UnsupportedFormat = 'unsupportedFormat',
  MissingBucket = 'missingBucket',
  FileTooLarge = 'fileTooLarge',
  Unknown = 'unknown',
}

/** What one unit of a transfer job's discoverable work represents. */
export enum ConversationTransferUnitKind {
  Attachment = 'attachment',
  Conversation = 'conversation',
}

/**
 * Countable progress within the phase a job is currently working through —
 * downloaded/uploaded attachments, or fetched/saved conversations. Describes
 * only that phase, never the job as a whole.
 */
export interface ConversationTransferProgressUnits {
  /** Units settled so far in the current phase. */
  completed: number;
  /** Units the current phase will settle in total. */
  total: number;
  /** What a unit represents. */
  kind: ConversationTransferUnitKind;
}

/**
 * A transfer job's completion, always determinate — there is no indeterminate
 * state, so a job is renderable as a real percentage from its first frame.
 */
export interface ConversationTransferProgress {
  /**
   * Completion as an integer 0–100. Monotonically non-decreasing for the life
   * of a job id: a write that would lower it is discarded rather than applied,
   * so a discovered unit count can subdivide the work still to do but can
   * never move the indicator backwards.
   */
  percent: number;
  /**
   * Readout for the phase currently advancing, for assistive technology.
   * Absent while the phase's unit count is unknown.
   */
  units?: ConversationTransferProgressUnits;
}

/** A queued export or import job. */
export interface ConversationTransferJob {
  id: string;
  subject: ConversationTransferSubject;
  status: ConversationTransferJobStatus;
  /** Name of the file this job writes (export) or reads (import), known at enqueue time. */
  fileName: string;
  /** Determinate completion of this job. */
  progress: ConversationTransferProgress;
  /** Why the job failed. Set only alongside {@link ConversationTransferJobStatus.Failed}. */
  errorCode?: ConversationTransferErrorCode;
}
