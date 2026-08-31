import {
  type Conversation,
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConversationExportMode,
  ConversationTransferErrorCode,
  ConversationTransferWarningCode,
} from '../../conversation-transfer/types';
import {
  useConversationExport,
  type UseConversationExportParams,
} from '../useConversationExport';

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

  it('warns and still succeeds when an attachment cannot be downloaded', async () => {
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
    expect(result.current.jobs[0].status).toBe(
      ConversationTransferJobStatus.Success,
    );
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
});
