/** Lifecycle status of a queued export/import job. */
export enum ConversationTransferJobStatus {
  InProgress = 'inProgress',
  Success = 'success',
  Failed = 'failed',
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

/** A queued export or import job. */
export interface ConversationTransferJob {
  id: string;
  subject: ConversationTransferSubject;
  status: ConversationTransferJobStatus;
}
