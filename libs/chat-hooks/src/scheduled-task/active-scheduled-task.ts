/** Resolution status of scheduler metadata for the currently routed conversation. */
export enum ActiveScheduledTaskStatus {
  Resolving = 'resolving',
  NotATaskConversation = 'not-a-task-conversation',
  TaskConversation = 'task-conversation',
}

/** Fetch status of the active task's own details (separate from its run history). */
export enum ActiveScheduledTaskDetailState {
  Idle = 'idle',
  Loading = 'loading',
  Error = 'error',
  Unavailable = 'unavailable',
  Success = 'success',
}

/** Minimal scheduler metadata supplied by the host. */
export interface ActiveScheduledTaskCandidate {
  /** Opaque conversation identity. */
  id: string;
  /** Whether the scheduler created this conversation. */
  isScheduledTask?: boolean;
  /** Schedule identity. */
  scheduleId?: string;
  /** Run identity. */
  runId?: string;
  /** Conversation update epoch. */
  updatedAt?: number;
  /** Conversation display title. */
  title?: string;
}
/** Inputs for resolving scheduler metadata without routing knowledge. */
export interface ResolveActiveScheduledTaskOptions {
  /** Guarded route identity, or null outside a conversation. */
  routeConversationId: string | null;
  /** Host feature decision. */
  enabled: boolean;
  /** Whether the conversation list is loading. */
  isLoading: boolean;
  /** Current conversation candidates. */
  items: readonly ActiveScheduledTaskCandidate[];
  /** Host identity matching policy. */
  matches: (candidateId: string, routeId: string) => boolean;
}
/** Resolved active-task metadata. */
export interface ActiveScheduledTaskResolution {
  /** Classification of the supplied conversation. */
  status: ActiveScheduledTaskStatus;
  /** Matched schedule identity. */
  scheduleId?: string;
  /** Matched run identity. */
  runId?: string;
  /** Matched conversation update epoch. */
  conversationUpdatedAt?: number;
  /** Matched conversation title. */
  conversationTitle?: string;
}
/** Resolves scheduler metadata using the caller's identity policy. */
export const resolveActiveScheduledTask = ({
  routeConversationId,
  enabled,
  isLoading,
  items,
  matches,
}: ResolveActiveScheduledTaskOptions): ActiveScheduledTaskResolution => {
  if (!routeConversationId || !enabled)
    return { status: ActiveScheduledTaskStatus.NotATaskConversation };
  const item = items.find((item) => matches(item.id, routeConversationId));
  if (!item)
    return {
      status: isLoading
        ? ActiveScheduledTaskStatus.Resolving
        : ActiveScheduledTaskStatus.NotATaskConversation,
    };
  if (!item.isScheduledTask || !item.scheduleId || !item.runId)
    return { status: ActiveScheduledTaskStatus.NotATaskConversation };
  return {
    status: ActiveScheduledTaskStatus.TaskConversation,
    scheduleId: item.scheduleId,
    runId: item.runId,
    conversationUpdatedAt: item.updatedAt,
    conversationTitle: item.title,
  };
};
