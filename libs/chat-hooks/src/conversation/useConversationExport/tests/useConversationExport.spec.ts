import {
  type Conversation,
  ConversationTransferErrorCode,
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
  ConversationTransferUnitKind,
  triggerBlobDownload,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConversationExportMode,
  ConversationTransferWarningCode,
} from '../../conversation-transfer/types';
import { buildDialArchive } from '../../conversation-transfer/zip-export';
import {
  useConversationExport,
  type UseConversationExportParams,
} from '../useConversationExport';

vi.mock('../../conversation-transfer/zip-export', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../conversation-transfer/zip-export')
    >();
  return { ...actual, buildDialArchive: vi.fn(actual.buildDialArchive) };
});

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, triggerBlobDownload: vi.fn() };
});

const makeConversation = (
  overrides: Partial<Conversation> = {},
): Conversation => ({
  id: 'bucket-a/gpt-4o__My Chat',
  folderId: 'bucket-a',
  name: 'My Chat',
  model: { id: 'gpt-4o' },
  prompt: '',
  temperature: 0.5,
  messages: [],
  lastActivityDate: 1000,
  updatedAt: 2000,
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
  ...overrides,
});

describe('useConversationExport', () => {
  const normalizeConversationPath = (id: string) => id;
  let onSuccess: ReturnType<typeof vi.fn>;
  let onWarning: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;
  let getConversation: ReturnType<typeof vi.fn>;
  let listConversations: ReturnType<typeof vi.fn>;
  let downloadFileRaw: ReturnType<typeof vi.fn>;

  const renderExport = () => {
    getConversation = vi.fn().mockResolvedValue(makeConversation());
    listConversations = vi.fn();
    downloadFileRaw = vi.fn();
    onSuccess = vi.fn();
    onWarning = vi.fn();
    onError = vi.fn();

    return renderHook(() =>
      useConversationExport({
        conversationsApi: { getConversation, listConversations },
        filesApi: { downloadFileRaw },
        normalizeConversationPath,
        onSuccess,
        onWarning,
        onError,
      } as unknown as UseConversationExportParams),
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with an empty job queue', () => {
    const { result } = renderExport();
    expect(result.current.jobs).toEqual([]);
  });

  it('adds an in-progress job immediately when exportSingle starts', async () => {
    const { result } = renderExport();
    act(() => {
      void result.current.exportSingle(
        'bucket-a/gpt-4o__My Chat',
        'My Chat',
        ConversationExportMode.WithoutAttachments,
      );
    });
    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0].subject).toEqual({
      kind: ConversationTransferSubjectKind.Single,
      title: 'My Chat',
    });
  });

  it('exports a conversation without attachments and reports success', async () => {
    const { result } = renderExport();
    await act(() =>
      result.current.exportSingle(
        'bucket-a/gpt-4o__My Chat',
        'My Chat',
        ConversationExportMode.WithoutAttachments,
      ),
    );

    expect(onSuccess).toHaveBeenCalledWith({
      jobId: result.current.jobs[0].id,
      titles: ['My Chat'],
    });
    expect(result.current.jobs[0].status).toBe(
      ConversationTransferJobStatus.Success,
    );
  });

  it('supports multiple concurrent jobs with independent status', async () => {
    const { result } = renderExport();
    getConversation.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(makeConversation()), 10),
        ),
    );

    act(() => {
      void result.current.exportSingle(
        'a',
        'A',
        ConversationExportMode.WithoutAttachments,
      );
      void result.current.exportSingle(
        'b',
        'B',
        ConversationExportMode.WithoutAttachments,
      );
    });

    expect(result.current.jobs).toHaveLength(2);
    await waitFor(() =>
      expect(
        result.current.jobs.every(
          (job) => job.status === ConversationTransferJobStatus.Success,
        ),
      ).toBe(true),
    );
  });

  it('fetches attachments and bundles them into an archive', async () => {
    const { result } = renderExport();
    getConversation.mockResolvedValue(
      makeConversation({
        messages: [
          {
            role: 'assistant' as Conversation['messages'][number]['role'],
            content: '',
            timestamp: '2026-07-10T00:00:00.000Z',
            custom_content: {
              attachments: [{ title: 'q1.pdf', url: 'files/bucket-a/q1.pdf' }],
            },
          },
        ],
      }),
    );
    downloadFileRaw.mockResolvedValue({
      raw: { arrayBuffer: async () => new TextEncoder().encode('pdf').buffer },
    });

    await act(() =>
      result.current.exportSingle(
        'bucket-a/gpt-4o__My Chat',
        'My Chat',
        ConversationExportMode.WithAttachments,
      ),
    );

    expect(downloadFileRaw).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('settles at Warning, still delivering the archive, when an attachment cannot be downloaded', async () => {
    const { result } = renderExport();
    getConversation.mockResolvedValue(
      makeConversation({
        messages: [
          {
            role: 'assistant' as Conversation['messages'][number]['role'],
            content: '',
            timestamp: '2026-07-10T00:00:00.000Z',
            custom_content: {
              attachments: [{ title: 'q1.pdf', url: 'files/bucket-a/q1.pdf' }],
            },
          },
        ],
      }),
    );
    downloadFileRaw.mockRejectedValue(new Error('network'));

    await act(() =>
      result.current.exportSingle(
        'bucket-a/gpt-4o__My Chat',
        'My Chat',
        ConversationExportMode.WithAttachments,
      ),
    );

    expect(onWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ConversationTransferWarningCode.AttachmentSkipped,
      }),
    );
    expect(result.current.jobs[0]).toMatchObject({
      status: ConversationTransferJobStatus.Warning,
      warningCode: ConversationTransferWarningCode.AttachmentSkipped,
      progress: { percent: 100 },
    });
    expect(vi.mocked(triggerBlobDownload)).toHaveBeenCalledOnce();
  });

  it('reports unauthorized without a success/warning event', async () => {
    const { result } = renderExport();
    const classify = () => ({ isUnauthorized: true });
    getConversation.mockRejectedValue(new Error('401'));

    const { result: result2 } = renderHook(() =>
      useConversationExport({
        conversationsApi: { getConversation, listConversations },
        filesApi: { downloadFileRaw },
        normalizeConversationPath,
        classifyTransferError: classify,
        onSuccess,
        onWarning,
        onError,
      } as unknown as UseConversationExportParams),
    );

    await act(() =>
      result2.current.exportSingle(
        'bucket-a/gpt-4o__My Chat',
        'My Chat',
        ConversationExportMode.WithoutAttachments,
      ),
    );

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onWarning).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ConversationTransferErrorCode.Unauthorized,
      }),
    );
    expect(result2.current.jobs[0].status).toBe(
      ConversationTransferJobStatus.Failed,
    );
    void result;
  });

  it('paginates export-all and excludes shared/published conversations', async () => {
    const { result } = renderExport();
    listConversations
      .mockResolvedValueOnce({
        items: [
          { id: 'a', title: 'A', sharedWithMe: false, publishedWithMe: false },
          { id: 'b', title: 'B', sharedWithMe: true, publishedWithMe: false },
        ],
        nextToken: 'next',
      })
      .mockResolvedValueOnce({
        items: [
          { id: 'c', title: 'C', sharedWithMe: false, publishedWithMe: true },
          { id: 'd', title: 'D', sharedWithMe: false, publishedWithMe: false },
        ],
      });
    getConversation.mockImplementation((params: { path: string }) =>
      Promise.resolve(makeConversation({ id: params.path, name: params.path })),
    );

    await act(() => result.current.exportAll());

    expect(getConversation).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('dismisses a finished job', async () => {
    const { result } = renderExport();
    await act(() =>
      result.current.exportSingle(
        'bucket-a/gpt-4o__My Chat',
        'My Chat',
        ConversationExportMode.WithoutAttachments,
      ),
    );
    const jobId = result.current.jobs[0].id;
    act(() => result.current.dismissJob(jobId));
    expect(result.current.jobs).toEqual([]);
  });

  it('aborts the in-flight request when dismissed mid-export', async () => {
    const { result } = renderExport();
    let capturedSignal: AbortSignal | undefined;
    getConversation.mockImplementation(
      (_params: unknown, options: { signal: AbortSignal }) => {
        capturedSignal = options.signal;
        return new Promise(() => {
          /* never resolves */
        });
      },
    );

    act(() => {
      void result.current.exportSingle(
        'bucket-a/gpt-4o__My Chat',
        'My Chat',
        ConversationExportMode.WithoutAttachments,
      );
    });
    const jobId = result.current.jobs[0].id;
    act(() => result.current.dismissJob(jobId));

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.jobs).toEqual([]);
  });

  it('retries a failed job and reuses the same job id on success', async () => {
    const { result } = renderExport();
    getConversation.mockRejectedValueOnce(new Error('boom'));
    await act(() =>
      result.current.exportSingle(
        'bucket-a/gpt-4o__My Chat',
        'My Chat',
        ConversationExportMode.WithoutAttachments,
      ),
    );
    const jobId = result.current.jobs[0].id;
    expect(result.current.jobs[0].status).toBe(
      ConversationTransferJobStatus.Failed,
    );

    getConversation.mockResolvedValueOnce(makeConversation());
    await act(() => {
      result.current.retryJob(jobId);
      return Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.jobs[0].status).toBe(
        ConversationTransferJobStatus.Success,
      ),
    );
    expect(result.current.jobs[0].id).toBe(jobId);
  });

  it('aborts every in-flight request when the host component unmounts', () => {
    const { result, unmount } = renderExport();
    let capturedSignal: AbortSignal | undefined;
    getConversation.mockImplementation(
      (_params: unknown, options: { signal: AbortSignal }) => {
        capturedSignal = options.signal;
        return new Promise(() => {
          /* never resolves */
        });
      },
    );

    act(() => {
      void result.current.exportSingle(
        'bucket-a/gpt-4o__My Chat',
        'My Chat',
        ConversationExportMode.WithoutAttachments,
      );
    });
    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  describe('file naming', () => {
    it('names the job at enqueue with the file it will download', async () => {
      const { result } = renderExport();

      await act(() =>
        result.current.exportSingle(
          'bucket-a/gpt-4o__My Chat',
          'My Chat',
          ConversationExportMode.WithoutAttachments,
        ),
      );

      const { fileName } = result.current.jobs[0];
      expect(fileName).toMatch(
        /^\d{4}-\d{2}-\d{2}_ai_dial_chat_conversation\.json$/,
      );
      expect(vi.mocked(triggerBlobDownload)).toHaveBeenCalledWith(
        expect.any(Blob),
        fileName,
      );
    });

    it('names an attachment export with the .dial archive it will download', () => {
      const { result } = renderExport();
      getConversation.mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          }),
      );

      act(() => {
        void result.current.exportSingle(
          'bucket-a/gpt-4o__My Chat',
          'My Chat',
          ConversationExportMode.WithAttachments,
        );
      });

      expect(result.current.jobs[0].fileName).toMatch(
        /^\d{4}-\d{2}-\d{2}_ai_dial_chat_with_attachments\.dial$/,
      );
    });
  });

  describe('progress', () => {
    it('advances one slice per settled attachment and completes at 100', async () => {
      const { result } = renderExport();
      getConversation.mockResolvedValue(
        makeConversation({
          messages: [
            {
              role: 'assistant' as Conversation['messages'][number]['role'],
              content: '',
              timestamp: '2026-07-10T00:00:00.000Z',
              custom_content: {
                attachments: [
                  { title: 'a.pdf', url: 'files/bucket-a/a.pdf' },
                  { title: 'b.pdf', url: 'files/bucket-a/b.pdf' },
                  { title: 'c.pdf', url: 'files/bucket-a/c.pdf' },
                ],
              },
            },
          ],
        }),
      );

      const releases: Array<() => void> = [];
      downloadFileRaw.mockImplementation(
        () =>
          new Promise((resolve) => {
            releases.push(() =>
              resolve({
                raw: {
                  arrayBuffer: async () =>
                    new TextEncoder().encode('pdf').buffer,
                },
              }),
            );
          }),
      );

      let exportPromise: Promise<void> = Promise.resolve();
      await act(async () => {
        exportPromise = result.current.exportSingle(
          'bucket-a/gpt-4o__My Chat',
          'My Chat',
          ConversationExportMode.WithAttachments,
        );
        await Promise.resolve();
      });

      await waitFor(() => expect(releases).toHaveLength(3));
      expect(result.current.jobs[0].progress.percent).toBe(15);

      await act(async () => {
        releases[0]();
        await Promise.resolve();
      });
      await waitFor(() =>
        expect(result.current.jobs[0].progress).toEqual({
          percent: 38,
          units: {
            completed: 1,
            total: 3,
            kind: ConversationTransferUnitKind.Attachment,
          },
        }),
      );

      await act(async () => {
        releases[1]();
        releases[2]();
        await exportPromise;
      });

      expect(result.current.jobs[0]).toMatchObject({
        status: ConversationTransferJobStatus.Success,
        progress: { percent: 100 },
      });
    });

    it('completes an attachment-free archive export without any download', async () => {
      const { result } = renderExport();

      await act(() =>
        result.current.exportSingle(
          'bucket-a/gpt-4o__My Chat',
          'My Chat',
          ConversationExportMode.WithAttachments,
        ),
      );

      expect(downloadFileRaw).not.toHaveBeenCalled();
      expect(result.current.jobs[0]).toMatchObject({
        status: ConversationTransferJobStatus.Success,
        progress: { percent: 100 },
      });
    });
  });

  describe('cancellation', () => {
    it('keeps the row, downloads nothing, and reports no success', async () => {
      const { result } = renderExport();
      getConversation.mockResolvedValue(
        makeConversation({
          messages: [
            {
              role: 'assistant' as Conversation['messages'][number]['role'],
              content: '',
              timestamp: '2026-07-10T00:00:00.000Z',
              custom_content: {
                attachments: [
                  { title: 'q1.pdf', url: 'files/bucket-a/q1.pdf' },
                ],
              },
            },
          ],
        }),
      );
      let capturedSignal: AbortSignal | undefined;
      downloadFileRaw.mockImplementation(
        (_params: unknown, options: { signal: AbortSignal }) => {
          capturedSignal = options.signal;
          return new Promise(() => {
            /* never resolves */
          });
        },
      );

      await act(async () => {
        void result.current.exportSingle(
          'bucket-a/gpt-4o__My Chat',
          'My Chat',
          ConversationExportMode.WithAttachments,
        );
        await Promise.resolve();
      });
      await waitFor(() => expect(capturedSignal).toBeDefined());

      act(() => {
        result.current.cancelJob(result.current.jobs[0].id);
      });

      expect(capturedSignal?.aborted).toBe(true);
      expect(result.current.jobs).toHaveLength(1);
      expect(result.current.jobs[0].status).toBe(
        ConversationTransferJobStatus.Canceled,
      );
      expect(vi.mocked(triggerBlobDownload)).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('archive size limit', () => {
    const renderExportWithLimit = (maxArchiveBytes: number) => {
      getConversation = vi.fn().mockResolvedValue(
        makeConversation({
          messages: [
            {
              role: 'assistant' as Conversation['messages'][number]['role'],
              content: '',
              timestamp: '2026-07-10T00:00:00.000Z',
              custom_content: {
                attachments: [
                  { title: 'q1.pdf', url: 'files/bucket-a/q1.pdf' },
                ],
              },
            },
          ],
        }),
      );
      listConversations = vi.fn();
      downloadFileRaw = vi.fn().mockResolvedValue({
        raw: {
          arrayBuffer: async () =>
            new TextEncoder().encode('0123456789').buffer,
        },
      });
      onSuccess = vi.fn();
      onWarning = vi.fn();
      onError = vi.fn();

      return renderHook(() =>
        useConversationExport({
          conversationsApi: { getConversation, listConversations },
          filesApi: { downloadFileRaw },
          normalizeConversationPath,
          maxArchiveBytes,
          onSuccess,
          onWarning,
          onError,
        } as unknown as UseConversationExportParams),
      );
    };

    it('fails as FileTooLarge before the archive is built', async () => {
      const { result } = renderExportWithLimit(4);

      await act(() =>
        result.current.exportSingle(
          'bucket-a/gpt-4o__My Chat',
          'My Chat',
          ConversationExportMode.WithAttachments,
        ),
      );

      expect(vi.mocked(buildDialArchive)).not.toHaveBeenCalled();
      expect(vi.mocked(triggerBlobDownload)).not.toHaveBeenCalled();
      expect(result.current.jobs[0]).toMatchObject({
        status: ConversationTransferJobStatus.Failed,
        errorCode: ConversationTransferErrorCode.FileTooLarge,
      });
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ConversationTransferErrorCode.FileTooLarge,
        }),
      );
    });

    it('builds normally when the attachments fit', async () => {
      const { result } = renderExportWithLimit(1024);

      await act(() =>
        result.current.exportSingle(
          'bucket-a/gpt-4o__My Chat',
          'My Chat',
          ConversationExportMode.WithAttachments,
        ),
      );

      expect(vi.mocked(buildDialArchive)).toHaveBeenCalledOnce();
      expect(result.current.jobs[0].status).toBe(
        ConversationTransferJobStatus.Success,
      );
    });

    it('maps an allocation failure to FileTooLarge, not Unknown', async () => {
      const { result } = renderExportWithLimit(1024);
      vi.mocked(buildDialArchive).mockImplementationOnce(() => {
        throw new RangeError('Array buffer allocation failed');
      });

      await act(() =>
        result.current.exportSingle(
          'bucket-a/gpt-4o__My Chat',
          'My Chat',
          ConversationExportMode.WithAttachments,
        ),
      );

      expect(result.current.jobs[0].errorCode).toBe(
        ConversationTransferErrorCode.FileTooLarge,
      );
    });
  });
});
