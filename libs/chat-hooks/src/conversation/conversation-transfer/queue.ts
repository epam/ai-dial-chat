import {
  type ConversationTransferErrorCode,
  type ConversationTransferJob,
  ConversationTransferJobStatus,
  type ConversationTransferProgress,
  type ConversationTransferSubject,
  type ConversationTransferWarningCode,
  generateUUID,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TRANSFER_PROGRESS_COMPLETE } from './progress';

/** Shared job-queue primitive underlying both `useConversationExport` and `useConversationImport`. */
export interface ConversationTransferQueue {
  /** Queued jobs, most recently added last. */
  jobs: ConversationTransferJob[];
  /** Adds a new `InProgress` job for `subject`, named `fileName`, at 0% and returns its id. */
  addJob: (subject: ConversationTransferSubject, fileName: string) => string;
  /** Merges `patch` into the job identified by `jobId`. */
  updateJob: (jobId: string, patch: Partial<ConversationTransferJob>) => void;
  /**
   * Advances the job's progress. A write whose `percent` is lower than the
   * stored value is discarded, so out-of-order completions from concurrent
   * transfers cannot move the indicator backwards, and a write to a job that
   * has already settled is ignored, so an aborted run unwinding in the
   * background cannot advance a canceled or failed row.
   */
  setJobProgress: (
    jobId: string,
    progress: ConversationTransferProgress,
  ) => void;
  /** Marks the job `Success` at 100%. */
  succeedJob: (jobId: string) => void;
  /**
   * Marks the job `Warning` at 100%, recording what was incomplete. The file
   * was still delivered, so this settles the job exactly as `succeedJob` does
   * apart from the status and the attached code.
   */
  warnJob: (
    jobId: string,
    warningCode: ConversationTransferWarningCode,
  ) => void;
  /** Marks the job `Failed`, recording why. Progress freezes where it stopped. */
  failJob: (jobId: string, errorCode: ConversationTransferErrorCode) => void;
  /**
   * Aborts the job's in-flight request(s) and marks it `Canceled`, keeping the
   * row so the user has a record of what they stopped. The job stays retryable.
   */
  cancelJob: (jobId: string) => void;
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
 * `AbortController` tracking, monotonic progress, retry-function
 * registration, and unmount cleanup. Shared by `useConversationExport` and
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

  const setJobProgress = useCallback(
    (jobId: string, progress: ConversationTransferProgress) => {
      setJobs((prev) =>
        prev.map((job) => {
          if (job.id !== jobId) return job;
          if (job.status !== ConversationTransferJobStatus.InProgress) {
            return job;
          }
          if (progress.percent < job.progress.percent) return job;
          return { ...job, progress };
        }),
      );
    },
    [],
  );

  const addJob = useCallback(
    (subject: ConversationTransferSubject, fileName: string): string => {
      const jobId = generateUUID();
      setJobs((prev) => [
        ...prev,
        {
          id: jobId,
          subject,
          status: ConversationTransferJobStatus.InProgress,
          fileName,
          progress: { percent: 0 },
        },
      ]);
      return jobId;
    },
    [],
  );

  const succeedJob = useCallback(
    (jobId: string) => {
      updateJob(jobId, {
        status: ConversationTransferJobStatus.Success,
        progress: { percent: TRANSFER_PROGRESS_COMPLETE },
        errorCode: undefined,
      });
    },
    [updateJob],
  );

  const warnJob = useCallback(
    (jobId: string, warningCode: ConversationTransferWarningCode) => {
      setJobs((prev) =>
        prev.map((job) => {
          if (job.id !== jobId) return job;
          /*
           * A warning is raised after the transfer body has already finished,
           * so it can land late. Refuse to relabel a job the user has since
           * canceled — settling one here would turn their canceled row back
           * into a delivered one.
           */
          if (job.status !== ConversationTransferJobStatus.InProgress) {
            return job;
          }
          return {
            ...job,
            status: ConversationTransferJobStatus.Warning,
            progress: { percent: TRANSFER_PROGRESS_COMPLETE },
            errorCode: undefined,
            warningCode,
          };
        }),
      );
    },
    [],
  );

  const failJob = useCallback(
    (jobId: string, errorCode: ConversationTransferErrorCode) => {
      updateJob(jobId, {
        status: ConversationTransferJobStatus.Failed,
        errorCode,
      });
    },
    [updateJob],
  );

  const cancelJob = useCallback(
    (jobId: string) => {
      controllersRef.current.get(jobId)?.abort();
      controllersRef.current.delete(jobId);
      updateJob(jobId, { status: ConversationTransferJobStatus.Canceled });
    },
    [updateJob],
  );

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
        updateJob(jobId, {
          status: ConversationTransferJobStatus.InProgress,
          progress: { percent: 0 },
          errorCode: undefined,
        });
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
    setJobProgress,
    succeedJob,
    warnJob,
    failJob,
    cancelJob,
    dismissJob,
    retryJob,
    dismissAll,
    startJob,
  };
};
