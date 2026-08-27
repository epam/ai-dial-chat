import { generateUUID } from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConversationTransferJobStatus,
  type ConversationTransferJob,
  type ConversationTransferSubject,
} from './types';

/** Shared job-queue primitive underlying both `useConversationExport` and `useConversationImport`. */
export interface ConversationTransferQueue {
  /** Queued jobs, most recently added last. */
  jobs: ConversationTransferJob[];
  /** Adds a new `InProgress` job for `subject` and returns its id. */
  addJob: (subject: ConversationTransferSubject) => string;
  /** Merges `patch` into the job identified by `jobId`. */
  updateJob: (jobId: string, patch: Partial<ConversationTransferJob>) => void;
  /** Aborts the job's in-flight request (if any) and removes it from `jobs`. */
  dismissJob: (jobId: string) => void;
  /** Re-invokes the job's registered run function under a fresh `AbortController`. */
  retryJob: (jobId: string) => void;
  /** Aborts every in-flight job and clears the queue. */
  dismissAll: () => void;
  /**
   * Runs `run` under a fresh `AbortController` registered for `jobId`, and
   * registers the same `run` function to be re-invoked (under a new
   * controller) on `retryJob`.
   */
  startJob: (
    jobId: string,
    run: (signal: AbortSignal) => Promise<void>,
  ) => Promise<void>;
}

/**
 * Owns the export/import job queue: job list state, per-job
 * `AbortController` tracking, retry-function registration, and
 * unmount cleanup. Shared by `useConversationExport` and
 * `useConversationImport` so both hooks have identical cancellation,
 * retry, and dismissal semantics.
 */
export const useConversationTransferQueue = (): ConversationTransferQueue => {
  const [jobs, setJobs] = useState<ConversationTransferJob[]>([]);
  const controllersRef = useRef(new Map<string, AbortController>());
  const retryFnsRef = useRef(new Map<string, () => Promise<void>>());

  const updateJob = useCallback(
    (jobId: string, patch: Partial<ConversationTransferJob>) => {
      setJobs((prev) =>
        prev.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
      );
    },
    [],
  );

  const addJob = useCallback((subject: ConversationTransferSubject): string => {
    const jobId = generateUUID();
    setJobs((prev) => [
      ...prev,
      { id: jobId, subject, status: ConversationTransferJobStatus.InProgress },
    ]);
    return jobId;
  }, []);

  const dismissJob = useCallback((jobId: string) => {
    controllersRef.current.get(jobId)?.abort();
    controllersRef.current.delete(jobId);
    retryFnsRef.current.delete(jobId);
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
  }, []);

  const retryJob = useCallback((jobId: string) => {
    void retryFnsRef.current.get(jobId)?.();
  }, []);

  const dismissAll = useCallback(() => {
    for (const controller of controllersRef.current.values()) {
      controller.abort();
    }
    controllersRef.current.clear();
    retryFnsRef.current.clear();
    setJobs([]);
  }, []);

  const startJob = useCallback(
    (
      jobId: string,
      run: (signal: AbortSignal) => Promise<void>,
    ): Promise<void> => {
      const invoke = (): Promise<void> => {
        const controller = new AbortController();
        controllersRef.current.set(jobId, controller);
        return run(controller.signal);
      };
      retryFnsRef.current.set(jobId, () => {
        updateJob(jobId, { status: ConversationTransferJobStatus.InProgress });
        return invoke();
      });
      return invoke();
    },
    [updateJob],
  );

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
    };
  }, []);

  return {
    jobs,
    addJob,
    updateJob,
    dismissJob,
    retryJob,
    dismissAll,
    startJob,
  };
};
