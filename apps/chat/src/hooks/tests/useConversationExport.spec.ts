import { ResponseError } from '@epam/ai-dial-chat-api-client';
import { triggerBlobDownload } from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { useNotification } from '../../context/NotificationContext';
import { createNotificationContextValue } from '../../context/tests/notification-context-mock';
import { UnauthorizedError } from '../../server-api/base';
import { downloadFile } from '../../server-api/files.api';
import {
  ConversationExportMode,
  ExportJobStatus,
} from '../../types/conversation-export';
import { useConversationExport } from '../useConversationExport';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

vi.mock('../../context/NotificationContext');

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, triggerBlobDownload: vi.fn() };
});

const mockGetConversation = vi.fn();
const mockListConversations = vi.fn();
vi.mock('../../server-api/conversations.api', () => ({
  getConversation: (...args: unknown[]) => mockGetConversation(...args),
  listConversations: (...args: unknown[]) => mockListConversations(...args),
}));

vi.mock('../../server-api/files.api', () => ({
  downloadFile: vi.fn(),
}));

const mockShowNotification = vi.fn();

const makeConversation = (overrides: Record<string, unknown> = {}) => ({
  id: 'conv-1',
  folderId: 'root',
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

const makeAttachmentMessage = (fileId: string, title: string) => ({
  role: 'assistant',
  content: '',
  timestamp: '2026-07-10T00:00:00.000Z',
  custom_content: { attachments: [{ title, url: fileId }] },
});

describe('useConversationExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('job queue basics', () => {
    it('starts with an empty queue', () => {
      const { result } = renderHook(() => useConversationExport());
      expect(result.current.jobs).toEqual([]);
    });

    it('adds an in-progress job immediately when exportSingle is called', () => {
      mockGetConversation.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useConversationExport());

      act(() => {
        void result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithoutAttachments,
        );
      });

      expect(result.current.jobs).toHaveLength(1);
      expect(result.current.jobs[0]).toMatchObject({
        label: 'My Chat',
        status: ExportJobStatus.InProgress,
      });
    });

    it('supports multiple concurrent jobs with independent status', async () => {
      const conversationA = makeConversation({
        id: 'conv-a',
        messages: Array.from({ length: 4 }, (_, i) =>
          makeAttachmentMessage(`files/bucket/a-${i}.png`, `a-${i}`),
        ),
      });
      const conversationB = makeConversation({ id: 'conv-b', messages: [] });

      mockGetConversation.mockImplementation(async (path: string) =>
        path === 'conv-a' ? conversationA : conversationB,
      );
      const attachmentResolvers: Array<() => void> = [];
      vi.mocked(downloadFile).mockImplementation(
        () =>
          new Promise((resolve) => {
            attachmentResolvers.push(() =>
              resolve(new Response(new Blob(['x']))),
            );
          }),
      );

      const { result } = renderHook(() => useConversationExport());

      let promiseA!: Promise<void>;
      let promiseB!: Promise<void>;
      act(() => {
        promiseA = result.current.exportSingle(
          'conv-a',
          'Chat A',
          ConversationExportMode.WithAttachments,
        );
        promiseB = result.current.exportSingle(
          'conv-b',
          'Chat B',
          ConversationExportMode.WithoutAttachments,
        );
      });

      // B (no attachments) completes quickly; A stays in progress mid-attachment-fetch.
      await act(async () => {
        await promiseB;
      });

      expect(result.current.jobs).toHaveLength(2);
      const jobA = result.current.jobs.find((j) => j.label === 'Chat A');
      const jobB = result.current.jobs.find((j) => j.label === 'Chat B');
      expect(jobA?.status).toBe(ExportJobStatus.InProgress);
      expect(jobB?.status).toBe(ExportJobStatus.Success);

      await act(async () => {
        attachmentResolvers.forEach((release) => release());
        await promiseA;
      });

      expect(
        result.current.jobs.find((j) => j.label === 'Chat A')?.status,
      ).toBe(ExportJobStatus.Success);
    });
  });

  describe('exportSingle — without attachments', () => {
    it('downloads a JSON file, shows a success toast, and marks the job successful', async () => {
      mockGetConversation.mockResolvedValue(makeConversation());
      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithoutAttachments,
        );
      });

      expect(mockGetConversation).toHaveBeenCalledWith(
        'conv-1',
        expect.any(AbortSignal),
      );
      expect(triggerBlobDownload).toHaveBeenCalledOnce();
      const [blob, fileName] = vi.mocked(triggerBlobDownload).mock.calls[0];
      expect(blob.type).toBe('application/json');
      expect(fileName).toMatch(/_chat_conversation\.json$/);
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'success',
          title: 'conversationExport.successTitle',
        }),
      );
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('strips the "conversations/" domain prefix before calling getConversation (regression: 400 from DIAL Core)', async () => {
      mockGetConversation.mockResolvedValue(makeConversation());
      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conversations/bucket-xyz/chathub-claude4__requirements.txt',
          'My Chat',
          ConversationExportMode.WithoutAttachments,
        );
      });

      expect(mockGetConversation).toHaveBeenCalledWith(
        'bucket-xyz/chathub-claude4__requirements.txt',
        expect.any(AbortSignal),
      );
    });

    it('decodes an already-percent-encoded Quick App deployment id segment before calling getConversation (regression: double-encoding 400 from DIAL Core)', async () => {
      mockGetConversation.mockResolvedValue(makeConversation());
      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conversations/bucket-xyz/applications/bucket-xyz/My%20App__0.0.1__title__uuid',
          'My Chat',
          ConversationExportMode.WithoutAttachments,
        );
      });

      expect(mockGetConversation).toHaveBeenCalledWith(
        'bucket-xyz/applications/bucket-xyz/My App__0.0.1__title__uuid',
        expect.any(AbortSignal),
      );
    });
  });

  describe('exportSingle — with attachments', () => {
    it('fetches a file referenced by multiple messages only once', async () => {
      const conversation = makeConversation({
        messages: [
          makeAttachmentMessage('files/bucket/shared.png', 'shared'),
          makeAttachmentMessage('files/bucket/shared.png', 'shared again'),
        ],
      });
      mockGetConversation.mockResolvedValue(conversation);
      vi.mocked(downloadFile).mockResolvedValue(
        new Response(new Blob(['bytes'])),
      );

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithAttachments,
        );
      });

      expect(downloadFile).toHaveBeenCalledOnce();
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('bundles fetched attachments into a .dial archive and marks the job successful', async () => {
      const conversation = makeConversation({
        messages: [
          makeAttachmentMessage('files/bucket/reports/q1.pdf', 'q1.pdf'),
        ],
      });
      mockGetConversation.mockResolvedValue(conversation);
      vi.mocked(downloadFile).mockResolvedValue(
        new Response(new Blob(['pdf-bytes'])),
      );

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithAttachments,
        );
      });

      expect(downloadFile).toHaveBeenCalledWith(
        'bucket',
        'reports/q1.pdf',
        expect.any(AbortSignal),
      );
      expect(triggerBlobDownload).toHaveBeenCalledOnce();
      const [blob, fileName] = vi.mocked(triggerBlobDownload).mock.calls[0];
      expect(blob.type).toBe('application/zip');
      expect(fileName).toMatch(/_chat_with_attachments\.dial$/);
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('caps attachment-fetch concurrency at 5', async () => {
      const fileIds = Array.from(
        { length: 12 },
        (_, i) => `files/bucket/attachments/file-${i}.png`,
      );
      const conversation = makeConversation({
        messages: fileIds.map((id, i) => makeAttachmentMessage(id, `f${i}`)),
      });
      mockGetConversation.mockResolvedValue(conversation);

      let inFlight = 0;
      let maxInFlight = 0;
      const resolvers: Array<() => void> = [];
      vi.mocked(downloadFile).mockImplementation(
        () =>
          new Promise((resolve) => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            resolvers.push(() => {
              inFlight -= 1;
              resolve(new Response(new Blob(['x'])));
            });
          }),
      );

      const { result } = renderHook(() => useConversationExport());
      let exportPromise!: Promise<void>;
      act(() => {
        exportPromise = result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithAttachments,
        );
      });

      await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(5));
      expect(maxInFlight).toBe(5);

      while (
        vi.mocked(downloadFile).mock.calls.length < fileIds.length ||
        resolvers.length > 0
      ) {
        resolvers.shift()?.();

        // A microtask-only tick can starve the macrotask (Blob#arrayBuffer)
        // the next downloadFile call needs to progress, spinning forever.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      await act(async () => {
        await exportPromise;
      });

      expect(downloadFile).toHaveBeenCalledTimes(fileIds.length);
      expect(maxInFlight).toBeLessThanOrEqual(5);
    });

    it('skips a failed attachment, shows a warning, and still succeeds the job', async () => {
      const conversation = makeConversation({
        messages: [
          makeAttachmentMessage('files/bucket/ok.png', 'ok'),
          makeAttachmentMessage('files/bucket/broken.png', 'broken'),
        ],
      });
      mockGetConversation.mockResolvedValue(conversation);
      vi.mocked(downloadFile).mockImplementation(async (_bucket, path) => {
        if (path === 'broken.png') throw new Error('network error');
        return new Response(new Blob(['ok-bytes']));
      });

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithAttachments,
        );
      });

      expect(triggerBlobDownload).toHaveBeenCalledOnce();
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'warning',
          message: 'conversationExport.warningAttachmentSkipped',
        }),
      );
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('shows no toast and aborts the archive when a 401 occurs during attachment download', async () => {
      const conversation = makeConversation({
        messages: [
          makeAttachmentMessage('files/bucket/ok.png', 'ok'),
          makeAttachmentMessage('files/bucket/secret.png', 'secret'),
        ],
      });
      mockGetConversation.mockResolvedValue(conversation);
      vi.mocked(downloadFile).mockImplementation(async (_bucket, path) => {
        if (path === 'secret.png') {
          throw new UnauthorizedError('/api/v1/files/download');
        }
        return new Response(new Blob(['ok-bytes']));
      });

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithAttachments,
        );
      });

      expect(triggerBlobDownload).not.toHaveBeenCalled();
      expect(mockShowNotification).not.toHaveBeenCalled();
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Failed);
    });

    it('shows a single consolidated warning when a failed download and an invalid archive path both occur', async () => {
      const conversation = makeConversation({
        messages: [
          makeAttachmentMessage('files/bucket/broken.png', 'broken'),
          makeAttachmentMessage('files/bucket/bad%20name.png', 'bad name'),
        ],
      });
      mockGetConversation.mockResolvedValue(conversation);
      vi.mocked(downloadFile).mockImplementation(async (_bucket, path) => {
        if (path === 'broken.png') throw new Error('network error');
        return new Response(new Blob(['bytes']));
      });

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithAttachments,
        );
      });

      const warningCalls = mockShowNotification.mock.calls.filter(
        ([arg]) => arg.variant === 'warning',
      );
      expect(warningCalls).toHaveLength(1);
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('marks the job failed and shows an error toast when archive building throws', async () => {
      const conversation = makeConversation({
        messages: [makeAttachmentMessage('files/bucket/ok.png', 'ok')],
      });
      mockGetConversation.mockResolvedValue(conversation);
      vi.mocked(downloadFile).mockResolvedValue(
        new Response(new Blob(['ok-bytes'])),
      );
      const zipExport = await import('../../utils/zip-export');
      const buildSpy = vi
        .spyOn(zipExport, 'buildDialArchive')
        .mockImplementation(() => {
          throw new RangeError('Invalid array length');
        });

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithAttachments,
        );
      });

      expect(triggerBlobDownload).not.toHaveBeenCalled();
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          title: 'conversationExport.failedTitle',
        }),
      );
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Failed);

      buildSpy.mockRestore();
    });
  });

  describe('exportAll', () => {
    it('paginates through nextToken and succeeds the job', async () => {
      mockListConversations
        .mockResolvedValueOnce({
          items: [
            { id: 'conversations/bucket-a/chat-one.txt', title: 'Chat One' },
          ],
          nextToken: 'page-2',
        })
        .mockResolvedValueOnce({
          items: [
            { id: 'conversations/bucket-a/chat-two.txt', title: 'Chat Two' },
          ],
          nextToken: undefined,
        });
      mockGetConversation.mockImplementation(async (path: string) =>
        makeConversation({ id: path }),
      );

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportAll();
      });

      expect(mockListConversations).toHaveBeenCalledTimes(2);
      expect(mockGetConversation).toHaveBeenCalledWith(
        'bucket-a/chat-one.txt',
        expect.any(AbortSignal),
      );
      expect(mockGetConversation).toHaveBeenCalledWith(
        'bucket-a/chat-two.txt',
        expect.any(AbortSignal),
      );
      expect(triggerBlobDownload).toHaveBeenCalledOnce();
      const [, fileName] = vi.mocked(triggerBlobDownload).mock.calls[0];
      expect(fileName).toMatch(/_chat_conversations_history\.json$/);
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'success',
          message: 'conversationExport.successAll',
        }),
      );
      expect(result.current.jobs[0]).toMatchObject({
        label: 'conversationExport.allConversationsJobLabel',
        status: ExportJobStatus.Success,
      });
    });

    it('excludes conversations shared with me or published to the organization', async () => {
      mockListConversations.mockResolvedValueOnce({
        items: [
          { id: 'conv-own', title: 'My Own Chat' },
          { id: 'conv-shared', title: 'Shared Chat', sharedWithMe: true },
          {
            id: 'conv-org',
            title: 'Org Chat',
            publishedWithMe: true,
          },
        ],
        nextToken: undefined,
      });
      mockGetConversation.mockImplementation(async (path: string) =>
        makeConversation({ id: path }),
      );

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportAll();
      });

      expect(mockGetConversation).toHaveBeenCalledOnce();
      expect(mockGetConversation).toHaveBeenCalledWith(
        'conv-own',
        expect.any(AbortSignal),
      );
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('skips a 404 conversation with a per-title toast and continues with the rest', async () => {
      mockListConversations.mockResolvedValueOnce({
        items: [
          { id: 'conv-1', title: 'Missing Chat' },
          { id: 'conv-2', title: 'Chat Two' },
        ],
        nextToken: undefined,
      });
      mockGetConversation.mockImplementation(async (path: string) => {
        if (path === 'conv-1') {
          throw new ResponseError(
            new Response(null, { status: 404 }),
            'not found',
          );
        }
        return makeConversation({ id: path });
      });

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportAll();
      });

      expect(triggerBlobDownload).toHaveBeenCalledOnce();
      const [blob] = vi.mocked(triggerBlobDownload).mock.calls[0];
      const parsed = JSON.parse(await readBlobAsText(blob));
      expect(parsed.history).toHaveLength(1);
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          title: 'conversationExport.failedTitle',
          message: expect.stringContaining('"title":"Missing Chat"'),
        }),
      );
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('marks the job failed when a conversation fetch returns a server error', async () => {
      mockListConversations.mockResolvedValueOnce({
        items: [{ id: 'conv-1', title: 'Chat One' }],
        nextToken: undefined,
      });
      mockGetConversation.mockRejectedValue(
        new ResponseError(new Response(null, { status: 500 }), 'boom'),
      );

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportAll();
      });

      expect(triggerBlobDownload).not.toHaveBeenCalled();
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          title: 'conversationExport.failedTitle',
          message: 'conversationExport.failedAll',
        }),
      );
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Failed);
    });

    it('shows no toast for a 401 while listing conversations but still marks the job failed', async () => {
      mockListConversations.mockRejectedValue(
        new UnauthorizedError('/api/v1/conversations'),
      );

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportAll();
      });

      expect(triggerBlobDownload).not.toHaveBeenCalled();
      expect(mockShowNotification).not.toHaveBeenCalled();
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Failed);
    });

    it('shows no toast for a 401 while fetching a conversation but still marks the job failed', async () => {
      mockListConversations.mockResolvedValueOnce({
        items: [{ id: 'conv-1', title: 'Chat One' }],
        nextToken: undefined,
      });
      mockGetConversation.mockRejectedValue(
        new UnauthorizedError('/api/v1/conversations/conv-1'),
      );

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportAll();
      });

      expect(triggerBlobDownload).not.toHaveBeenCalled();
      expect(mockShowNotification).not.toHaveBeenCalled();
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Failed);
    });
  });

  describe('error mapping', () => {
    it('shows the generic per-title failure toast for a non-401 error and marks the job failed', async () => {
      mockGetConversation.mockRejectedValue(
        new ResponseError(new Response(null, { status: 403 }), 'error'),
      );

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithoutAttachments,
        );
      });

      expect(triggerBlobDownload).not.toHaveBeenCalled();
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          title: 'conversationExport.failedTitle',
          message: expect.stringContaining('"title":"My Chat"'),
        }),
      );
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Failed);
    });

    it('shows no toast for a 401 but still marks the job failed (terminal state)', async () => {
      mockGetConversation.mockRejectedValue(
        new UnauthorizedError('/api/v1/conversations/conv-1'),
      );

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithoutAttachments,
        );
      });

      expect(triggerBlobDownload).not.toHaveBeenCalled();
      expect(mockShowNotification).not.toHaveBeenCalled();
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Failed);
    });

    it('logs errors via console.error without sensitive data', async () => {
      mockGetConversation.mockRejectedValue(
        new ResponseError(new Response(null, { status: 500 }), 'error'),
      );

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithoutAttachments,
        );
      });

      expect(console.error).toHaveBeenCalled();
      const loggedArgs = (console.error as unknown as Mock).mock.calls.flat();
      const serialized = JSON.stringify(loggedArgs);
      expect(serialized).not.toMatch(/token|cookie/i);
    });
  });

  describe('dismissJob', () => {
    it('removes a finished job from the queue', async () => {
      mockGetConversation.mockResolvedValue(makeConversation());
      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithoutAttachments,
        );
      });
      const jobId = result.current.jobs[0].id;

      act(() => {
        result.current.dismissJob(jobId);
      });

      expect(result.current.jobs).toEqual([]);
    });

    it('aborts the in-flight request and removes the job when dismissed mid-export', async () => {
      let capturedSignal: AbortSignal | undefined;
      mockGetConversation.mockImplementation(
        (_path: string, signal?: AbortSignal) => {
          capturedSignal = signal;
          return new Promise(() => undefined);
        },
      );

      const { result } = renderHook(() => useConversationExport());

      act(() => {
        void result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithoutAttachments,
        );
      });
      const jobId = result.current.jobs[0].id;

      act(() => {
        result.current.dismissJob(jobId);
      });

      expect(capturedSignal?.aborted).toBe(true);
      expect(result.current.jobs).toEqual([]);
    });
  });

  describe('retryJob', () => {
    it('re-attempts a failed job and reuses the same job id on success', async () => {
      mockGetConversation
        .mockRejectedValueOnce(
          new ResponseError(new Response(null, { status: 500 }), 'boom'),
        )
        .mockResolvedValueOnce(makeConversation());

      const { result } = renderHook(() => useConversationExport());

      await act(async () => {
        await result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithoutAttachments,
        );
      });
      const jobId = result.current.jobs[0].id;
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Failed);

      act(() => {
        result.current.retryJob(jobId);
      });
      await waitFor(() =>
        expect(result.current.jobs[0]?.status).toBe(ExportJobStatus.Success),
      );

      expect(result.current.jobs).toHaveLength(1);
      expect(result.current.jobs[0].id).toBe(jobId);
      expect(mockGetConversation).toHaveBeenCalledTimes(2);
    });
  });

  describe('unmount', () => {
    it('aborts every in-flight request when the host component unmounts', () => {
      let capturedSignal: AbortSignal | undefined;
      mockGetConversation.mockImplementation(
        (_path: string, signal?: AbortSignal) => {
          capturedSignal = signal;
          return new Promise(() => undefined);
        },
      );

      const { result, unmount } = renderHook(() => useConversationExport());

      act(() => {
        void result.current.exportSingle(
          'conv-1',
          'My Chat',
          ConversationExportMode.WithoutAttachments,
        );
      });

      unmount();

      expect(capturedSignal?.aborted).toBe(true);
    });
  });
});

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
