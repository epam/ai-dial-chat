import {
  ConversationTransferErrorCode,
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
  ConversationTransferUnitKind,
  ConversationTransferWarningCode,
  type ConversationTransferSubject,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useConversationTransferQueue } from '../queue';

const SUBJECT: ConversationTransferSubject = {
  kind: ConversationTransferSubjectKind.Single,
  title: 'My chat',
};

const FILE_NAME = '2026-09-01_ai_dial_chat_with_attachments.dial';

/** Adds one job and returns its id alongside the rendered hook. */
const renderQueueWithJob = () => {
  const view = renderHook(() => useConversationTransferQueue());
  let jobId = '';
  act(() => {
    jobId = view.result.current.addJob(SUBJECT, FILE_NAME);
  });
  return { ...view, jobId };
};

describe('useConversationTransferQueue', () => {
  it('enqueues a determinate job named by its file', () => {
    const { result } = renderQueueWithJob();

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0]).toMatchObject({
      subject: SUBJECT,
      status: ConversationTransferJobStatus.InProgress,
      fileName: FILE_NAME,
      progress: { percent: 0 },
    });
    expect(result.current.jobs[0].progress.units).toBeUndefined();
  });

  describe('setJobProgress', () => {
    it('advances progress and carries the unit readout', () => {
      const { result, jobId } = renderQueueWithJob();

      act(() => {
        result.current.setJobProgress(jobId, {
          percent: 36,
          units: {
            completed: 3,
            total: 10,
            kind: ConversationTransferUnitKind.Attachment,
          },
        });
      });

      expect(result.current.jobs[0].progress).toEqual({
        percent: 36,
        units: {
          completed: 3,
          total: 10,
          kind: ConversationTransferUnitKind.Attachment,
        },
      });
    });

    it('discards a write that would move progress backwards', () => {
      const { result, jobId } = renderQueueWithJob();

      act(() => {
        result.current.setJobProgress(jobId, { percent: 70 });
      });
      act(() => {
        result.current.setJobProgress(jobId, { percent: 40 });
      });

      expect(result.current.jobs[0].progress.percent).toBe(70);
    });

    it('keeps the higher value when concurrent completions interleave', () => {
      const { result, jobId } = renderQueueWithJob();

      act(() => {
        result.current.setJobProgress(jobId, { percent: 50 });
        result.current.setJobProgress(jobId, { percent: 43 });
      });

      expect(result.current.jobs[0].progress.percent).toBe(50);
    });

    it('ignores a write to a job that has already settled', () => {
      const { result, jobId } = renderQueueWithJob();

      act(() => {
        result.current.setJobProgress(jobId, { percent: 42 });
      });
      act(() => {
        result.current.cancelJob(jobId);
      });
      act(() => {
        result.current.setJobProgress(jobId, { percent: 90 });
      });

      expect(result.current.jobs[0].progress.percent).toBe(42);
    });

    it('leaves other jobs untouched', () => {
      const { result, jobId } = renderQueueWithJob();
      let otherId = '';
      act(() => {
        otherId = result.current.addJob(SUBJECT, 'other.json');
      });

      act(() => {
        result.current.setJobProgress(jobId, { percent: 60 });
      });

      const other = result.current.jobs.find((job) => job.id === otherId);
      expect(other?.progress.percent).toBe(0);
    });
  });

  describe('succeedJob', () => {
    it('completes the ring regardless of where the arithmetic left it', () => {
      const { result, jobId } = renderQueueWithJob();

      act(() => {
        result.current.setJobProgress(jobId, { percent: 98 });
      });
      act(() => {
        result.current.succeedJob(jobId);
      });

      expect(result.current.jobs[0]).toMatchObject({
        status: ConversationTransferJobStatus.Success,
        progress: { percent: 100 },
      });
      expect(result.current.jobs[0].errorCode).toBeUndefined();
    });
  });

  describe('warnJob', () => {
    it('settles like a success but records what was incomplete', () => {
      const { result, jobId } = renderQueueWithJob();

      act(() => {
        result.current.setJobProgress(jobId, { percent: 61 });
      });
      act(() => {
        result.current.warnJob(
          jobId,
          ConversationTransferWarningCode.AttachmentSkipped,
        );
      });

      expect(result.current.jobs[0]).toMatchObject({
        status: ConversationTransferJobStatus.Warning,
        warningCode: ConversationTransferWarningCode.AttachmentSkipped,
        progress: { percent: 100 },
      });
      expect(result.current.jobs[0].errorCode).toBeUndefined();
    });

    it('refuses to relabel a job the user has already canceled', () => {
      const { result, jobId } = renderQueueWithJob();

      act(() => {
        result.current.cancelJob(jobId);
      });
      act(() => {
        result.current.warnJob(
          jobId,
          ConversationTransferWarningCode.AttachmentSkipped,
        );
      });

      expect(result.current.jobs[0].status).toBe(
        ConversationTransferJobStatus.Canceled,
      );
      expect(result.current.jobs[0].warningCode).toBeUndefined();
    });
  });

  describe('failJob', () => {
    it('records the reason and freezes progress', () => {
      const { result, jobId } = renderQueueWithJob();

      act(() => {
        result.current.setJobProgress(jobId, { percent: 42 });
      });
      act(() => {
        result.current.failJob(
          jobId,
          ConversationTransferErrorCode.FileTooLarge,
        );
      });

      expect(result.current.jobs[0]).toMatchObject({
        status: ConversationTransferJobStatus.Failed,
        errorCode: ConversationTransferErrorCode.FileTooLarge,
        progress: { percent: 42 },
      });
    });
  });

  describe('cancelJob', () => {
    it('aborts the in-flight run but keeps the row', async () => {
      const { result } = renderHook(() => useConversationTransferQueue());
      let jobId = '';
      let capturedSignal: AbortSignal | undefined;

      act(() => {
        jobId = result.current.addJob(SUBJECT, FILE_NAME);
      });
      await act(async () => {
        await result.current.startJob(jobId, async (signal) => {
          capturedSignal = signal;
        });
      });
      act(() => {
        result.current.setJobProgress(jobId, { percent: 42 });
      });
      act(() => {
        result.current.cancelJob(jobId);
      });

      expect(capturedSignal?.aborted).toBe(true);
      expect(result.current.jobs).toHaveLength(1);
      expect(result.current.jobs[0]).toMatchObject({
        status: ConversationTransferJobStatus.Canceled,
        progress: { percent: 42 },
      });
    });

    it('leaves the job retryable', async () => {
      const { result } = renderHook(() => useConversationTransferQueue());
      const run = vi.fn(async () => undefined);
      let jobId = '';

      act(() => {
        jobId = result.current.addJob(SUBJECT, FILE_NAME);
      });
      await act(async () => {
        await result.current.startJob(jobId, run);
      });
      act(() => {
        result.current.cancelJob(jobId);
      });
      await act(async () => {
        result.current.retryJob(jobId);
      });

      expect(run).toHaveBeenCalledTimes(2);
      expect(result.current.jobs[0].status).toBe(
        ConversationTransferJobStatus.InProgress,
      );
    });
  });

  describe('retryJob', () => {
    it('resets progress and clears the recorded error', async () => {
      const { result } = renderHook(() => useConversationTransferQueue());
      let jobId = '';

      act(() => {
        jobId = result.current.addJob(SUBJECT, FILE_NAME);
      });
      await act(async () => {
        await result.current.startJob(jobId, async () => undefined);
      });
      act(() => {
        result.current.setJobProgress(jobId, { percent: 80 });
        result.current.failJob(jobId, ConversationTransferErrorCode.Unknown);
      });
      await act(async () => {
        result.current.retryJob(jobId);
      });

      expect(result.current.jobs[0]).toMatchObject({
        status: ConversationTransferJobStatus.InProgress,
        progress: { percent: 0 },
      });
      expect(result.current.jobs[0].errorCode).toBeUndefined();
    });
  });

  describe('dismissJob', () => {
    it('aborts and removes the row', async () => {
      const { result } = renderHook(() => useConversationTransferQueue());
      let jobId = '';
      let capturedSignal: AbortSignal | undefined;

      act(() => {
        jobId = result.current.addJob(SUBJECT, FILE_NAME);
      });
      await act(async () => {
        await result.current.startJob(jobId, async (signal) => {
          capturedSignal = signal;
        });
      });
      act(() => {
        result.current.dismissJob(jobId);
      });

      expect(capturedSignal?.aborted).toBe(true);
      expect(result.current.jobs).toHaveLength(0);
    });
  });
});
