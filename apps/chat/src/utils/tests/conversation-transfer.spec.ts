import {
  ConversationTransferErrorCode,
  type ConversationTransferJob,
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
  ConversationTransferWarningCode,
} from '@epam/ai-dial-chat-shared';
import { TransferQueueItemStatus } from '@epam/ai-dial-ui-kit';
import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationImportI18nKeys } from '../../constants/translation-keys';
import {
  formatTransferNameList,
  toTransferQueueItems,
  TRANSFER_NAME_LIST_LIMIT,
} from '../conversation-transfer';

describe('formatTransferNameList', () => {
  /*
   * Stands in for i18next: renders the `nameListWithRest` template so the
   * assertions read as the string a user would actually see.
   */
  const translate = vi.fn(
    (_key: string, options?: { names?: string; count?: number }) =>
      `${options?.names} and ${options?.count} others`,
  );
  const t = translate as unknown as TFunction;

  const namesOfLength = (length: number): string[] =>
    Array.from({ length }, (_, index) => `Name ${index + 1}`);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty string for no names', () => {
    expect(formatTransferNameList([], t)).toBe('');
    expect(translate).not.toHaveBeenCalled();
  });

  it('quotes and joins a list that fits within the limit', () => {
    expect(formatTransferNameList(['A', 'B', 'C'], t)).toBe('"A", "B", "C"');
    expect(translate).not.toHaveBeenCalled();
  });

  it('spells out every name when the list is exactly at the limit', () => {
    const names = namesOfLength(TRANSFER_NAME_LIST_LIMIT);

    expect(formatTransferNameList(names, t)).toBe(
      names.map((name) => `"${name}"`).join(', '),
    );
    expect(translate).not.toHaveBeenCalled();
  });

  it('summarizes the names beyond the limit as a count', () => {
    const names = namesOfLength(TRANSFER_NAME_LIST_LIMIT + 7);

    expect(formatTransferNameList(names, t)).toBe(
      '"Name 1", "Name 2", "Name 3", "Name 4", "Name 5" and 7 others',
    );
    expect(translate).toHaveBeenCalledWith(
      ConversationImportI18nKeys.NameListWithRest,
      {
        names: '"Name 1", "Name 2", "Name 3", "Name 4", "Name 5"',
        count: 7,
      },
    );
  });
});

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
});
