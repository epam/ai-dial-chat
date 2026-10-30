import { TransferQueueItemStatus } from '@epam/ai-dial-ui-kit';
import { describe, expect, it, vi } from 'vitest';
import {
  ConversationTransferErrorCode,
  type ConversationTransferJob,
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
  ConversationTransferWarningCode,
} from '../../models/conversation-transfer';
import { toConversationTransferQueueItems as toTransferQueueItems } from '../conversation-transfer-queue';

describe('toTransferQueueItems', () => {
  const makeJob = (
    overrides: Partial<ConversationTransferJob> = {},
  ): ConversationTransferJob => ({
    id: 'job-1',
    subject: { kind: ConversationTransferSubjectKind.All },
    status: ConversationTransferJobStatus.InProgress,
    fileName: 'export.dial',
    progress: { percent: 40 },
    ...overrides,
  });

  const resolvers = {
    getErrorMessage: vi.fn((code?: ConversationTransferErrorCode) =>
      code === ConversationTransferErrorCode.FileTooLarge
        ? 'Too large'
        : 'Failed',
    ),
    getWarningMessage: vi.fn(
      (_code?: ConversationTransferWarningCode, names?: string[]) =>
        `Skipped ${names?.join(', ') ?? 'some'}`,
    ),
  };

  it('keeps id, file name, percent and status', () => {
    expect(toTransferQueueItems([makeJob()], resolvers)).toEqual([
      {
        id: 'job-1',
        name: 'export.dial',
        status: TransferQueueItemStatus.InProgress,
        percent: 40,
        message: undefined,
      },
    ]);
  });

  it.each([
    [ConversationTransferJobStatus.Success, TransferQueueItemStatus.Success],
    [ConversationTransferJobStatus.Canceled, TransferQueueItemStatus.Canceled],
  ])('maps %s without a message', (status, expected) => {
    const [item] = toTransferQueueItems([makeJob({ status })], resolvers);

    expect(item.status).toBe(expected);
    expect(item.message).toBeUndefined();
  });

  it('resolves the failure reason from the error code', () => {
    const [item] = toTransferQueueItems(
      [
        makeJob({
          status: ConversationTransferJobStatus.Failed,
          errorCode: ConversationTransferErrorCode.FileTooLarge,
        }),
      ],
      resolvers,
    );

    expect(item.status).toBe(TransferQueueItemStatus.Failed);
    expect(item.message).toBe('Too large');
  });

  it('resolves the warning with the skipped names', () => {
    const [item] = toTransferQueueItems(
      [
        makeJob({
          status: ConversationTransferJobStatus.Warning,
          warningCode: ConversationTransferWarningCode.AttachmentSkipped,
          warningNames: ['a.png', 'b.png'],
        }),
      ],
      resolvers,
    );

    expect(item.status).toBe(TransferQueueItemStatus.Warning);
    expect(item.message).toBe('Skipped a.png, b.png');
  });

  it('does not mutate jobs and resolves only the matching missing-code message', () => {
    const failed = Object.freeze(
      makeJob({ status: ConversationTransferJobStatus.Failed }),
    );
    const warning = Object.freeze(
      makeJob({ status: ConversationTransferJobStatus.Warning }),
    );
    const jobs = Object.freeze([failed, warning]);
    const error = vi.fn(() => 'error');
    const warn = vi.fn(() => 'warning');
    const result = toTransferQueueItems(jobs, {
      getErrorMessage: error,
      getWarningMessage: warn,
    });
    expect(error).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(warn).toHaveBeenCalledExactlyOnceWith(undefined, undefined);
    expect(result.map((item) => item.message)).toEqual(['error', 'warning']);
    expect(jobs[0]).toBe(failed);
  });
});
