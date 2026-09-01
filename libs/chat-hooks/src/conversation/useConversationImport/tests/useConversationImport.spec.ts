import {
  ConversationTransferErrorCode,
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
  ConversationTransferUnitKind,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationTransferWarningCode } from '../../conversation-transfer/types';
import {
  useConversationImport,
  type UseConversationImportParams,
} from '../useConversationImport';

const jsonFile = (history: unknown[], name = 'export.json'): File =>
  new File([JSON.stringify({ version: 5, history, folders: [] })], name, {
    type: 'application/json',
  });

const dialFile = (
  history: unknown[],
  attachments: Record<string, string> = {},
  name = 'export.dial',
): File => {
  const files: Record<string, Uint8Array> = {
    'conversation.json': strToU8(
      JSON.stringify({ version: 5, history, folders: [] }),
    ),
  };
  for (const [path, content] of Object.entries(attachments)) {
    files[`res/${path}`] = strToU8(content);
  }
  const zipped = zipSync(files);
  return new File([new Uint8Array(zipped)], name, { type: 'application/zip' });
};

const makeConversation = (overrides: Record<string, unknown> = {}) => ({
  id: 'old-bucket/gpt-4o__My Chat',
  folderId: 'old-bucket',
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

describe('useConversationImport', () => {
  let saveConversation: ReturnType<typeof vi.fn>;
  let listFiles: ReturnType<typeof vi.fn>;
  let uploadFile: ReturnType<typeof vi.fn>;
  let onImported: ReturnType<typeof vi.fn>;
  let onSuccess: ReturnType<typeof vi.fn>;
  let onWarning: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;

  const renderImport = (bucket: string | undefined) => {
    saveConversation = vi.fn().mockResolvedValue(undefined);
    listFiles = vi.fn().mockResolvedValue({ items: [] });
    uploadFile = vi
      .fn()
      .mockResolvedValue({ url: 'files/new-bucket/uploads/2026-07/file.pdf' });
    onImported = vi.fn();
    onSuccess = vi.fn();
    onWarning = vi.fn();
    onError = vi.fn();

    return renderHook(() =>
      useConversationImport({
        conversationsApi: { saveConversation },
        filesApi: { listFiles, uploadFile },
        bucket,
        onImported,
        onSuccess,
        onWarning,
        onError,
      } as unknown as UseConversationImportParams),
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with an empty job queue', () => {
    const { result } = renderImport('new-bucket');
    expect(result.current.jobs).toEqual([]);
  });

  it('labels a single-conversation import job with the conversation name', async () => {
    const { result } = renderImport('new-bucket');
    act(() => {
      void result.current.importConversations(jsonFile([makeConversation()]));
    });
    await waitFor(() => expect(result.current.jobs).toHaveLength(1));
    expect(result.current.jobs[0].subject).toMatchObject({
      kind: ConversationTransferSubjectKind.Single,
      title: 'My Chat',
    });
  });

  it('labels a multi-conversation import job as All', async () => {
    const { result } = renderImport('new-bucket');
    act(() => {
      void result.current.importConversations(
        jsonFile([makeConversation(), makeConversation({ name: 'Other' })]),
      );
    });
    await waitFor(() => expect(result.current.jobs).toHaveLength(1));
    expect(result.current.jobs[0].subject).toEqual({
      kind: ConversationTransferSubjectKind.All,
    });
  });

  it('saves every conversation from a plain JSON file and reports success', async () => {
    const { result } = renderImport('new-bucket');
    await act(() =>
      result.current.importConversations(jsonFile([makeConversation()])),
    );

    expect(saveConversation).toHaveBeenCalledOnce();
    expect(uploadFile).not.toHaveBeenCalled();
    expect(onImported).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ titles: ['My Chat'] }),
    );
    expect(result.current.jobs[0].status).toBe(
      ConversationTransferJobStatus.Success,
    );
  });

  it('marks the saved conversation llmNamingDone: true', async () => {
    const { result } = renderImport('new-bucket');
    await act(() =>
      result.current.importConversations(jsonFile([makeConversation()])),
    );

    const [params] = saveConversation.mock.calls[0];
    expect(params.saveConversationBodyDto.conversation.llmNamingDone).toBe(
      true,
    );
  });

  it('rejects an unsupported file format without creating a job', async () => {
    const { result } = renderImport('new-bucket');
    await act(() =>
      result.current.importConversations(
        new File([JSON.stringify({ version: 4 })], 'bad.json'),
      ),
    );

    expect(result.current.jobs).toEqual([]);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ConversationTransferErrorCode.UnsupportedFormat,
      }),
    );
  });

  it('uploads archive attachments and rewrites references', async () => {
    const { result } = renderImport('new-bucket');
    const conversation = makeConversation({
      messages: [
        {
          role: 'assistant',
          content: '',
          timestamp: '2026-07-10T00:00:00.000Z',
          custom_content: {
            attachments: [{ title: 'q1.pdf', url: 'files/old-bucket/q1.pdf' }],
          },
        },
      ],
    });

    await act(() =>
      result.current.importConversations(
        dialFile([conversation], { 'q1.pdf': 'pdf-bytes' }),
      ),
    );

    expect(uploadFile).toHaveBeenCalledOnce();
    const [uploadParams] = uploadFile.mock.calls[0];
    expect(uploadParams.bucket).toBe('new-bucket');
    expect(uploadParams.uploadMode).toBe('create-only');
    expect(result.current.jobs[0].status).toBe(
      ConversationTransferJobStatus.Success,
    );
  });

  it('retries an upload under a suffixed name on a create-only 409', async () => {
    const { result } = renderImport('new-bucket');
    uploadFile
      .mockRejectedValueOnce({ response: { status: 409 } })
      .mockResolvedValueOnce({
        url: 'files/new-bucket/uploads/2026-07/q1%20(1).pdf',
      });
    const conversation = makeConversation({
      messages: [
        {
          role: 'assistant',
          content: '',
          timestamp: '2026-07-10T00:00:00.000Z',
          custom_content: {
            attachments: [{ title: 'q1.pdf', url: 'files/old-bucket/q1.pdf' }],
          },
        },
      ],
    });

    await act(() =>
      result.current.importConversations(
        dialFile([conversation], { 'q1.pdf': 'pdf-bytes' }),
      ),
    );

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(onWarning).not.toHaveBeenCalled();
    expect(result.current.jobs[0].status).toBe(
      ConversationTransferJobStatus.Success,
    );
  });

  it('skips an attachment and warns once the conflict retry limit is exhausted', async () => {
    const { result } = renderImport('new-bucket');
    uploadFile.mockRejectedValue({ response: { status: 409 } });
    const conversation = makeConversation({
      messages: [
        {
          role: 'assistant',
          content: '',
          timestamp: '2026-07-10T00:00:00.000Z',
          custom_content: {
            attachments: [{ title: 'q1.pdf', url: 'files/old-bucket/q1.pdf' }],
          },
        },
      ],
    });

    await act(() =>
      result.current.importConversations(
        dialFile([conversation], { 'q1.pdf': 'pdf-bytes' }),
      ),
    );

    expect(onWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ConversationTransferWarningCode.AttachmentSkipped,
        names: ['q1.pdf'],
      }),
    );
    expect(result.current.jobs[0]).toMatchObject({
      status: ConversationTransferJobStatus.Warning,
      warningCode: ConversationTransferWarningCode.AttachmentSkipped,
      progress: { percent: 100 },
    });
  });

  it('reports MissingBucket and fails the job when there is no bucket', async () => {
    const { result } = renderImport(undefined);
    await act(() =>
      result.current.importConversations(jsonFile([makeConversation()])),
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ConversationTransferErrorCode.MissingBucket,
      }),
    );
    expect(result.current.jobs[0].status).toBe(
      ConversationTransferJobStatus.Failed,
    );
  });

  it('reports partial success and failure for a batch with a mixed outcome', async () => {
    const { result } = renderImport('new-bucket');
    saveConversation
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'));

    await act(() =>
      result.current.importConversations(
        jsonFile([
          makeConversation({ name: 'Good' }),
          makeConversation({ name: 'Bad' }),
        ]),
      ),
    );

    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ titles: ['Good'] }),
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ titles: ['Bad'] }),
    );
    expect(result.current.jobs[0].status).toBe(
      ConversationTransferJobStatus.Failed,
    );
  });

  it('dismisses a finished job', async () => {
    const { result } = renderImport('new-bucket');
    await act(() =>
      result.current.importConversations(jsonFile([makeConversation()])),
    );
    const jobId = result.current.jobs[0].id;
    act(() => result.current.dismissJob(jobId));
    expect(result.current.jobs).toEqual([]);
  });

  it('aborts the in-flight request when dismissed mid-import', async () => {
    const { result } = renderImport('new-bucket');
    let capturedSignal: AbortSignal | undefined;
    saveConversation.mockImplementation(
      (_params: unknown, options: { signal: AbortSignal }) => {
        capturedSignal = options.signal;
        return new Promise(() => {
          /* never resolves */
        });
      },
    );

    act(() => {
      void result.current.importConversations(jsonFile([makeConversation()]));
    });
    await waitFor(() => expect(result.current.jobs).toHaveLength(1));
    const jobId = result.current.jobs[0].id;
    act(() => result.current.dismissJob(jobId));

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.jobs).toEqual([]);
  });

  it('retries a failed job reusing the already-parsed file and the same job id', async () => {
    const { result } = renderImport('new-bucket');
    saveConversation.mockRejectedValueOnce(new Error('boom'));
    await act(() =>
      result.current.importConversations(jsonFile([makeConversation()])),
    );
    const jobId = result.current.jobs[0].id;
    expect(result.current.jobs[0].status).toBe(
      ConversationTransferJobStatus.Failed,
    );

    saveConversation.mockResolvedValueOnce(undefined);
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

  it('aborts every in-flight request on unmount', async () => {
    const { result, unmount } = renderImport('new-bucket');
    let capturedSignal: AbortSignal | undefined;
    saveConversation.mockImplementation(
      (_params: unknown, options: { signal: AbortSignal }) => {
        capturedSignal = options.signal;
        return new Promise(() => {
          /* never resolves */
        });
      },
    );

    act(() => {
      void result.current.importConversations(jsonFile([makeConversation()]));
    });
    await waitFor(() => expect(result.current.jobs).toHaveLength(1));
    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  describe('file naming', () => {
    it('names the job after the selected file', async () => {
      const { result } = renderImport('new-bucket');

      await act(() =>
        result.current.importConversations(
          jsonFile([makeConversation()], 'my-backup.json'),
        ),
      );

      expect(result.current.jobs[0].fileName).toBe('my-backup.json');
    });
  });

  describe('progress', () => {
    it('advances through parse, upload, and save', async () => {
      const { result } = renderImport('new-bucket');
      const file = dialFile(
        [
          makeConversation({
            name: 'First',
            messages: [
              {
                role: 'assistant',
                content: '',
                timestamp: '2026-07-10T00:00:00.000Z',
                custom_content: {
                  attachments: [
                    { title: 'a.pdf', url: 'files/old-bucket/a.pdf' },
                  ],
                },
              },
            ],
          }),
          makeConversation({ id: 'old-bucket/gpt-4o__Second', name: 'Second' }),
        ],
        { 'a.pdf': 'pdf-bytes' },
      );

      const saveGates: Array<() => void> = [];
      saveConversation.mockImplementation(
        () =>
          new Promise((resolve) => {
            saveGates.push(() => resolve(undefined));
          }),
      );

      let importPromise: Promise<void> = Promise.resolve();
      await act(async () => {
        importPromise = result.current.importConversations(file);
        await Promise.resolve();
      });

      /* 10 prepare + 70 upload, with neither conversation saved yet. */
      await waitFor(() =>
        expect(result.current.jobs[0].progress.percent).toBe(80),
      );

      await waitFor(() => expect(saveGates).toHaveLength(1));
      await act(async () => {
        saveGates[0]();
        await Promise.resolve();
      });
      await waitFor(() =>
        expect(result.current.jobs[0].progress).toEqual({
          percent: 90,
          units: {
            completed: 1,
            total: 2,
            kind: ConversationTransferUnitKind.Conversation,
          },
        }),
      );

      await waitFor(() => expect(saveGates).toHaveLength(2));
      await act(async () => {
        saveGates[1]();
        await importPromise;
      });

      expect(result.current.jobs[0]).toMatchObject({
        status: ConversationTransferJobStatus.Success,
        progress: { percent: 100 },
      });
    });

    it('credits the upload phase in full for a plain JSON import', async () => {
      const { result } = renderImport('new-bucket');

      await act(() =>
        result.current.importConversations(jsonFile([makeConversation()])),
      );

      expect(uploadFile).not.toHaveBeenCalled();
      expect(result.current.jobs[0]).toMatchObject({
        status: ConversationTransferJobStatus.Success,
        progress: { percent: 100 },
      });
    });
  });

  describe('cancellation', () => {
    it('aborts the in-flight save but keeps the row', async () => {
      const { result } = renderImport('new-bucket');
      let capturedSignal: AbortSignal | undefined;
      saveConversation.mockImplementation(
        (_params: unknown, options: { signal: AbortSignal }) => {
          capturedSignal = options.signal;
          return new Promise(() => {
            /* never resolves */
          });
        },
      );

      act(() => {
        void result.current.importConversations(jsonFile([makeConversation()]));
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
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('error codes on the job', () => {
    it('records MissingBucket on the row, not only in the event', async () => {
      const { result } = renderImport(undefined);

      await act(() =>
        result.current.importConversations(jsonFile([makeConversation()])),
      );

      expect(result.current.jobs[0]).toMatchObject({
        status: ConversationTransferJobStatus.Failed,
        errorCode: ConversationTransferErrorCode.MissingBucket,
      });
    });

    it('records Unknown when a conversation fails to save', async () => {
      const { result } = renderImport('new-bucket');
      saveConversation.mockRejectedValue(new Error('boom'));

      await act(() =>
        result.current.importConversations(jsonFile([makeConversation()])),
      );

      expect(result.current.jobs[0]).toMatchObject({
        status: ConversationTransferJobStatus.Failed,
        errorCode: ConversationTransferErrorCode.Unknown,
      });
    });
  });
});
