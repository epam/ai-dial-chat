import {
  MessageRole,
  type Conversation,
  type ExportFormat,
} from '@epam/ai-dial-chat-shared';
import {
  ResponseError,
  type ConversationResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { useUser } from '../../context/auth/UserContext';
import { useConversations } from '../../context/ConversationsContext';
import { useNotification } from '../../context/NotificationContext';
import { UnauthorizedError } from '../../server-api/base';
import { saveConversation } from '../../server-api/conversations.api';
import { listFiles, uploadFile } from '../../server-api/files.api';
import { ExportJobStatus } from '../../types/conversation-export';
import { formatDateYM } from '../../utils/date';
import { useConversationImport } from '../useConversationImport';

/** The month folder `buildUploadPath`/the allocator would use for "now" — computed once per test run. */
const currentUploadMonth = (): string => formatDateYM(new Date());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

vi.mock('../../context/NotificationContext');
vi.mock('../../context/ConversationsContext');
vi.mock('../../context/auth/UserContext');

vi.mock('../../server-api/conversations.api', () => ({
  saveConversation: vi.fn(),
}));

vi.mock('../../server-api/files.api', () => ({
  uploadFile: vi.fn(),
  listFiles: vi.fn(),
}));

const mockShowNotification = vi.fn();
const mockRefreshConversations = vi.fn().mockResolvedValue(undefined);

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

const makeAttachmentMessage = (fileId: string, title: string) => ({
  role: MessageRole.Assistant,
  content: '',
  timestamp: '2026-07-10T00:00:00.000Z',
  custom_content: { attachments: [{ title, url: fileId }] },
});

const jsonFile = (envelope: ExportFormat, name = 'export.json'): File =>
  new File([JSON.stringify(envelope)], name, { type: 'application/json' });

const dialFile = (
  envelope: ExportFormat,
  attachments: Record<string, string> = {},
  name = 'export.dial',
): File => {
  const files: Record<string, Uint8Array> = {
    'conversation.json': strToU8(JSON.stringify(envelope)),
  };
  for (const [path, content] of Object.entries(attachments)) {
    files[`res/${path}`] = strToU8(content);
  }
  const zipped = zipSync(files);
  return new File([new Uint8Array(zipped)], name, {
    type: 'application/zip',
  });
};

describe('useConversationImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotification).mockReturnValue({
      notifications: [],
      showNotification: mockShowNotification,
      dismissNotification: vi.fn(),
    });
    vi.mocked(useConversations).mockReturnValue({
      conversations: [],
      isLoading: false,
      error: null,
      refreshConversations: mockRefreshConversations,
    } as unknown as ReturnType<typeof useConversations>);
    vi.mocked(useUser).mockReturnValue({
      status: 'authenticated',
      user: { bucket: 'user-bucket' },
      refresh: vi.fn(),
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useUser>);
    vi.mocked(listFiles).mockResolvedValue({
      bucket: 'user-bucket',
      path: '',
      items: [],
    } as never);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('job queue basics', () => {
    it('starts with an empty queue', () => {
      const { result } = renderHook(() => useConversationImport());
      expect(result.current.jobs).toEqual([]);
    });

    it('adds an in-progress job labeled with the conversation name for a single-conversation file', async () => {
      vi.mocked(saveConversation).mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [makeConversation({ name: 'My Chat' })],
        folders: [],
      });

      act(() => {
        void result.current.importConversations(file);
      });

      await waitFor(() => expect(result.current.jobs).toHaveLength(1));
      expect(result.current.jobs[0]).toMatchObject({
        label: 'My Chat',
        status: ExportJobStatus.InProgress,
      });
    });

    it('labels a multi-conversation file job "All conversations"', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [
          makeConversation({ id: 'bucket-a/gpt-4o__A', name: 'Chat A' }),
          makeConversation({ id: 'bucket-a/gpt-4o__B', name: 'Chat B' }),
        ],
        folders: [],
      });

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(result.current.jobs[0]).toMatchObject({
        label: 'conversationExport.allConversationsJobLabel',
      });
    });

    it('shows the source folder breadcrumb for a foldered single conversation', async () => {
      vi.mocked(saveConversation).mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [
          makeConversation({
            id: 'bucket-a/Folder 1/gpt-4o__My Chat',
            folderId: 'bucket-a/Folder 1',
          }),
        ],
        folders: [],
      });

      act(() => {
        void result.current.importConversations(file);
      });

      await waitFor(() => expect(result.current.jobs).toHaveLength(1));
      expect(result.current.jobs[0].description).toBe('Folder 1');
    });
  });

  describe('importConversations — plain JSON', () => {
    it('saves every conversation, refreshes the list, and shows a success toast', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [makeConversation({ name: 'My Chat' })],
        folders: [],
      });

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(saveConversation).toHaveBeenCalledOnce();
      const [subPath, conversation] = vi.mocked(saveConversation).mock.calls[0];
      expect(subPath).toMatch(/^gpt-4o__My Chat__[0-9a-f-]{36}$/);
      expect((conversation as Conversation).folderId).toBe('user-bucket');
      expect(mockRefreshConversations).toHaveBeenCalledOnce();
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      );
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('marks the saved conversation as llmNamingDone so the imported name is authoritative', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [makeConversation({ name: 'My Chat' })],
        folders: [],
      });

      await act(async () => {
        await result.current.importConversations(file);
      });

      const [, conversation] = vi.mocked(saveConversation).mock.calls[0];
      expect(
        (conversation as Conversation & { llmNamingDone?: boolean })
          .llmNamingDone,
      ).toBe(true);
    });

    it('does not attempt any attachment upload for a plain JSON file', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [
          makeConversation({
            messages: [
              makeAttachmentMessage('files/old-bucket/report.pdf', 'report'),
            ],
          }),
        ],
        folders: [],
      });

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(uploadFile).not.toHaveBeenCalled();
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('shows an unsupported-format toast and creates no job for a bad file', async () => {
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({ version: 4, history: [], folders: [] } as never);

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          message: 'conversationImport.unsupportedFormat',
        }),
      );
      expect(result.current.jobs).toEqual([]);
    });
  });

  describe('importConversations — multiple conversations, partial failure', () => {
    it('shows a success toast naming imports and a failure toast naming failures', async () => {
      vi.mocked(saveConversation).mockImplementation(async (path) => {
        if (path.includes('Bad')) throw new Error('save failed');
        return {} as never;
      });
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [
          makeConversation({ id: 'bucket-a/gpt-4o__Good', name: 'Good Chat' }),
          makeConversation({ id: 'bucket-a/gpt-4o__Bad', name: 'Bad Chat' }),
        ],
        folders: [],
      });

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'success',
          message: expect.stringContaining('Good Chat'),
        }),
      );
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          message: expect.stringContaining('Bad Chat'),
        }),
      );
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Failed);
    });
  });

  describe('importConversations — .dial archive', () => {
    it('uploads attachments to uploads/<month>/ and rewrites the reference', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      vi.mocked(uploadFile).mockResolvedValue({
        url: 'files/user-bucket/uploads/2026-07/q1.pdf',
      } as never);
      const { result } = renderHook(() => useConversationImport());
      const file = dialFile(
        {
          version: 5,
          history: [
            makeConversation({
              messages: [
                makeAttachmentMessage(
                  'files/old-bucket/reports/q1.pdf',
                  'q1.pdf',
                ),
              ],
            }),
          ],
          folders: [],
        },
        { 'reports/q1.pdf': 'pdf-bytes' },
      );

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(listFiles).toHaveBeenCalledOnce();
      const [listParams] = vi.mocked(listFiles).mock.calls[0];
      expect(listParams).toMatchObject({
        bucket: 'user-bucket',
        path: expect.stringMatching(/^uploads\/\d{4}-\d{2}$/),
      });

      expect(uploadFile).toHaveBeenCalledOnce();
      const [bucket, path, uploadedFile, options] =
        vi.mocked(uploadFile).mock.calls[0];
      expect(bucket).toBe('user-bucket');
      expect(path).toMatch(/^uploads\/\d{4}-\d{2}\/q1\.pdf$/);
      expect((uploadedFile as File).name).toBe('q1.pdf');
      expect(options).toMatchObject({ uploadMode: 'create-only' });

      const [, savedConversation] = vi.mocked(saveConversation).mock.calls[0];
      const attachment = (savedConversation as Conversation).messages[0]
        .custom_content?.attachments?.[0];
      expect(attachment?.url).toBe('files/user-bucket/uploads/2026-07/q1.pdf');
      expect(attachment?.title).toBe('q1.pdf');
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('never lists the upload folder for a plain JSON import', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [makeConversation()],
        folders: [],
      });

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(listFiles).not.toHaveBeenCalled();
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('suffixes an upload path when the destination name is already listed in the bucket', async () => {
      const month = currentUploadMonth();
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      vi.mocked(listFiles).mockResolvedValue({
        bucket: 'user-bucket',
        path: `uploads/${month}`,
        items: [{ name: 'q1.pdf' } as never],
      });
      vi.mocked(uploadFile).mockResolvedValue({
        url: `files/user-bucket/uploads/${month}/q1 (1).pdf`,
      } as never);
      const { result } = renderHook(() => useConversationImport());
      const file = dialFile(
        {
          version: 5,
          history: [
            makeConversation({
              messages: [
                makeAttachmentMessage(
                  'files/old-bucket/reports/q1.pdf',
                  'q1.pdf',
                ),
              ],
            }),
          ],
          folders: [],
        },
        { 'reports/q1.pdf': 'pdf-bytes' },
      );

      await act(async () => {
        await result.current.importConversations(file);
      });

      /* No wasted 409 round-trip: the pre-fill already knew the name was taken. */
      expect(uploadFile).toHaveBeenCalledOnce();
      const [, path, uploadedFile] = vi.mocked(uploadFile).mock.calls[0];
      expect(path).toBe(`uploads/${month}/q1%20(1).pdf`);
      expect((uploadedFile as File).name).toBe('q1 (1).pdf');

      const [, savedConversation] = vi.mocked(saveConversation).mock.calls[0];
      const attachment = (savedConversation as Conversation).messages[0]
        .custom_content?.attachments?.[0];
      expect(attachment?.title).toBe('q1 (1).pdf');
    });

    it('uploads the same source path referenced by two conversations twice, suffixing the second', async () => {
      const month = currentUploadMonth();
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      vi.mocked(uploadFile).mockResolvedValue({
        url: `files/user-bucket/uploads/${month}/q1.pdf`,
      } as never);
      const { result } = renderHook(() => useConversationImport());
      const file = dialFile(
        {
          version: 5,
          history: [
            makeConversation({
              id: 'bucket-a/gpt-4o__A',
              messages: [
                makeAttachmentMessage(
                  'files/old-bucket/reports/q1.pdf',
                  'q1.pdf',
                ),
              ],
            }),
            makeConversation({
              id: 'bucket-a/gpt-4o__B',
              messages: [
                makeAttachmentMessage(
                  'files/old-bucket/reports/q1.pdf',
                  'q1.pdf',
                ),
              ],
            }),
          ],
          folders: [],
        },
        { 'reports/q1.pdf': 'pdf-bytes' },
      );

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(uploadFile).toHaveBeenCalledTimes(2);
      const paths = vi.mocked(uploadFile).mock.calls.map((call) => call[1]);
      expect(paths).toEqual([
        `uploads/${month}/q1.pdf`,
        `uploads/${month}/q1%20(1).pdf`,
      ]);
    });

    it('uploads two refs sharing a basename from different source folders in one conversation, suffixing the second', async () => {
      const month = currentUploadMonth();
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      vi.mocked(uploadFile).mockResolvedValue({
        url: `files/user-bucket/uploads/${month}/q1.pdf`,
      } as never);
      const { result } = renderHook(() => useConversationImport());
      const file = dialFile(
        {
          version: 5,
          history: [
            makeConversation({
              messages: [
                makeAttachmentMessage(
                  'files/old-bucket/reports/q1.pdf',
                  'q1.pdf',
                ),
                makeAttachmentMessage('files/old-bucket/2025/q1.pdf', 'q1.pdf'),
              ],
            }),
          ],
          folders: [],
        },
        { 'reports/q1.pdf': 'a', '2025/q1.pdf': 'b' },
      );

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(uploadFile).toHaveBeenCalledTimes(2);
      const paths = vi.mocked(uploadFile).mock.calls.map((call) => call[1]);
      expect(paths).toEqual([
        `uploads/${month}/q1.pdf`,
        `uploads/${month}/q1%20(1).pdf`,
      ]);
    });

    it('uploads a file referenced by two messages of the same conversation only once', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      vi.mocked(uploadFile).mockResolvedValue({
        url: 'files/user-bucket/uploads/2026-07/q1.pdf',
      } as never);
      const { result } = renderHook(() => useConversationImport());
      const file = dialFile(
        {
          version: 5,
          history: [
            makeConversation({
              messages: [
                makeAttachmentMessage(
                  'files/old-bucket/reports/q1.pdf',
                  'q1.pdf',
                ),
                makeAttachmentMessage(
                  'files/old-bucket/reports/q1.pdf',
                  'q1.pdf',
                ),
              ],
            }),
          ],
          folders: [],
        },
        { 'reports/q1.pdf': 'pdf-bytes' },
      );

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(uploadFile).toHaveBeenCalledOnce();
    });

    it('assigns suffixes in reference order for a conversation with more attachments than the upload concurrency limit, regardless of upload resolution order', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      const resolvers: Array<() => void> = [];
      vi.mocked(uploadFile).mockImplementation(
        (_bucket, path) =>
          new Promise((resolve) => {
            resolvers.push(() =>
              resolve({ url: `files/user-bucket/${path}` } as never),
            );
          }),
      );
      const { result } = renderHook(() => useConversationImport());
      const attachmentEntries: Record<string, string> = {};
      const messages = Array.from({ length: 6 }, (_, index) => {
        const path = `folder-${index}/dup.pdf`;
        attachmentEntries[path] = `bytes-${index}`;
        return makeAttachmentMessage(`files/old-bucket/${path}`, 'dup.pdf');
      });
      const file = dialFile(
        {
          version: 5,
          history: [makeConversation({ messages })],
          folders: [],
        },
        attachmentEntries,
      );

      let importSettled = false;
      const importPromise = result.current
        .importConversations(file)
        .then(() => {
          importSettled = true;
        });

      /* ATTACHMENT_CONCURRENCY (5) workers start synchronously; the 6th only
       * starts once one of the first 5 resolves and frees a slot. */
      await waitFor(() => expect(resolvers.length).toBe(5));
      resolvers[0]();
      await waitFor(() => expect(resolvers.length).toBe(6));

      /* Resolve everything else in reverse invocation order to prove the
       * suffix each attachment got does not depend on resolution order. */
      for (let i = resolvers.length - 1; i >= 1; i -= 1) {
        resolvers[i]();
      }
      await act(async () => {
        await importPromise;
      });

      expect(importSettled).toBe(true);
      /* Whatever the current month is, the six suffixes must appear in
       * reference order (folder-0..folder-5), not upload-resolution order. */
      const paths = vi.mocked(uploadFile).mock.calls.map((call) => call[1]);
      const suffixes = paths.map((path) =>
        decodeURIComponent(path.split('/')[2]),
      );
      expect(suffixes).toEqual([
        'dup.pdf',
        'dup (1).pdf',
        'dup (2).pdf',
        'dup (3).pdf',
        'dup (4).pdf',
        'dup (5).pdf',
      ]);
    });

    it('detects the old-chat archive JSON entry name', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      const envelope: ExportFormat = {
        version: 5,
        history: [makeConversation({ name: 'Legacy Chat' })],
        folders: [],
      };
      const files: Record<string, Uint8Array> = {
        'conversations/conversations_history.json': strToU8(
          JSON.stringify(envelope),
        ),
      };
      const file = new File([new Uint8Array(zipSync(files))], 'legacy.zip', {
        type: 'application/zip',
      });

      const { result } = renderHook(() => useConversationImport());
      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(saveConversation).toHaveBeenCalledOnce();
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('skips an unfindable attachment, shows a warning, and still succeeds the job', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      const { result } = renderHook(() => useConversationImport());
      const file = dialFile(
        {
          version: 5,
          history: [
            makeConversation({
              messages: [
                makeAttachmentMessage(
                  'files/old-bucket/missing.pdf',
                  'missing',
                ),
              ],
            }),
          ],
          folders: [],
        },
        {},
      );

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'warning',
          message: expect.stringContaining('missing.pdf'),
        }),
      );
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('retries the upload under a suffixed name when a create-only 409 races another upload', async () => {
      const month = currentUploadMonth();
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      vi.mocked(uploadFile)
        .mockRejectedValueOnce(
          new ResponseError(new Response(null, { status: 409 }), 'Conflict'),
        )
        .mockResolvedValueOnce({
          url: `files/user-bucket/uploads/${month}/photo (1).png`,
        } as never);
      const { result } = renderHook(() => useConversationImport());
      const file = dialFile(
        {
          version: 5,
          history: [
            makeConversation({
              messages: [
                makeAttachmentMessage('files/old-bucket/photo.png', 'photo'),
              ],
            }),
          ],
          folders: [],
        },
        { 'photo.png': 'bytes' },
      );

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(uploadFile).toHaveBeenCalledTimes(2);
      const [, firstPath] = vi.mocked(uploadFile).mock.calls[0];
      const [, secondPath, secondFile] = vi.mocked(uploadFile).mock.calls[1];
      expect(firstPath).toBe(`uploads/${month}/photo.png`);
      expect(secondPath).toBe(`uploads/${month}/photo%20(1).png`);
      expect((secondFile as File).name).toBe('photo (1).png');
      expect(mockShowNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      );

      const [, savedConversation] = vi.mocked(saveConversation).mock.calls[0];
      const attachment = (savedConversation as Conversation).messages[0]
        .custom_content?.attachments?.[0];
      expect(attachment?.title).toBe('photo (1).png');
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('skips the attachment and shows a warning once the conflict retry limit is exhausted', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      vi.mocked(uploadFile).mockRejectedValue(
        new ResponseError(new Response(null, { status: 409 }), 'Conflict'),
      );
      const { result } = renderHook(() => useConversationImport());
      const file = dialFile(
        {
          version: 5,
          history: [
            makeConversation({
              messages: [
                makeAttachmentMessage('files/old-bucket/photo.png', 'photo'),
              ],
            }),
          ],
          folders: [],
        },
        { 'photo.png': 'bytes' },
      );

      await act(async () => {
        await result.current.importConversations(file);
      });

      /* One initial attempt plus ATTACHMENT_CONFLICT_RETRY_LIMIT (5) retries. */
      expect(uploadFile).toHaveBeenCalledTimes(6);
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'warning',
          message: expect.stringContaining('photo.png'),
        }),
      );
      expect(mockShowNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      );
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('still uploads attachments when listing the upload folder fails for a reason other than 401', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      vi.mocked(listFiles).mockRejectedValue(new Error('folder not found'));
      vi.mocked(uploadFile).mockResolvedValue({
        url: 'files/user-bucket/uploads/2026-07/q1.pdf',
      } as never);
      const { result } = renderHook(() => useConversationImport());
      const file = dialFile(
        {
          version: 5,
          history: [
            makeConversation({
              messages: [
                makeAttachmentMessage(
                  'files/old-bucket/reports/q1.pdf',
                  'q1.pdf',
                ),
              ],
            }),
          ],
          folders: [],
        },
        { 'reports/q1.pdf': 'pdf-bytes' },
      );

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(uploadFile).toHaveBeenCalledOnce();
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Success);
    });

    it('shows no toast and marks the job failed when listing the upload folder returns a 401', async () => {
      vi.mocked(listFiles).mockRejectedValue(
        new UnauthorizedError('/api/v1/files'),
      );
      const { result } = renderHook(() => useConversationImport());
      const file = dialFile(
        {
          version: 5,
          history: [
            makeConversation({
              messages: [
                makeAttachmentMessage(
                  'files/old-bucket/reports/q1.pdf',
                  'q1.pdf',
                ),
              ],
            }),
          ],
          folders: [],
        },
        { 'reports/q1.pdf': 'pdf-bytes' },
      );

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(uploadFile).not.toHaveBeenCalled();
      expect(saveConversation).not.toHaveBeenCalled();
      expect(mockShowNotification).not.toHaveBeenCalled();
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Failed);
    });

    it('shows no toast and marks the job failed on a 401 during attachment upload', async () => {
      vi.mocked(uploadFile).mockRejectedValue(
        new UnauthorizedError('/api/v1/files'),
      );
      const { result } = renderHook(() => useConversationImport());
      const file = dialFile(
        {
          version: 5,
          history: [
            makeConversation({
              messages: [
                makeAttachmentMessage('files/old-bucket/secret.pdf', 'secret'),
              ],
            }),
          ],
          folders: [],
        },
        { 'secret.pdf': 'bytes' },
      );

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(saveConversation).not.toHaveBeenCalled();
      expect(mockShowNotification).not.toHaveBeenCalled();
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Failed);
    });
  });

  describe('dismissJob', () => {
    it('removes a finished job from the queue', async () => {
      vi.mocked(saveConversation).mockResolvedValue({} as never);
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [makeConversation()],
        folders: [],
      });

      await act(async () => {
        await result.current.importConversations(file);
      });
      const jobId = result.current.jobs[0].id;

      act(() => {
        result.current.dismissJob(jobId);
      });

      expect(result.current.jobs).toEqual([]);
    });

    it('aborts the in-flight request and removes the job when dismissed mid-import', async () => {
      let capturedSignal: AbortSignal | undefined;
      vi.mocked(saveConversation).mockImplementation(
        (
          _path: string,
          _conversation: ConversationResponseDto,
          signal?: AbortSignal,
        ) => {
          capturedSignal = signal;
          return new Promise(() => undefined);
        },
      );
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [makeConversation()],
        folders: [],
      });

      act(() => {
        void result.current.importConversations(file);
      });
      await waitFor(() => expect(result.current.jobs).toHaveLength(1));
      const jobId = result.current.jobs[0].id;

      act(() => {
        result.current.dismissJob(jobId);
      });

      expect(capturedSignal?.aborted).toBe(true);
      expect(result.current.jobs).toEqual([]);
    });
  });

  describe('retryJob', () => {
    it('re-attempts a failed job reusing the already-parsed file and the same job id', async () => {
      vi.mocked(saveConversation)
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({} as never);
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [makeConversation()],
        folders: [],
      });

      await act(async () => {
        await result.current.importConversations(file);
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
      expect(saveConversation).toHaveBeenCalledTimes(2);
    });
  });

  describe('missing bucket', () => {
    it('fails the job when the user has no bucket', async () => {
      vi.mocked(useUser).mockReturnValue({
        status: 'authenticated',
        user: { bucket: '' },
        refresh: vi.fn(),
        reset: vi.fn(),
      } as unknown as ReturnType<typeof useUser>);
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [makeConversation()],
        folders: [],
      });

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(saveConversation).not.toHaveBeenCalled();
      expect(result.current.jobs[0].status).toBe(ExportJobStatus.Failed);
    });
  });

  describe('unmount', () => {
    it('aborts every in-flight request when the host component unmounts', async () => {
      let capturedSignal: AbortSignal | undefined;
      vi.mocked(saveConversation).mockImplementation(
        (
          _path: string,
          _conversation: ConversationResponseDto,
          signal?: AbortSignal,
        ) => {
          capturedSignal = signal;
          return new Promise(() => undefined);
        },
      );
      const { result, unmount } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [makeConversation()],
        folders: [],
      });

      act(() => {
        void result.current.importConversations(file);
      });
      await waitFor(() => expect(result.current.jobs).toHaveLength(1));

      unmount();

      expect(capturedSignal?.aborted).toBe(true);
    });
  });

  describe('error logging', () => {
    it('logs errors via console.error without sensitive data', async () => {
      vi.mocked(saveConversation).mockRejectedValue(new Error('save failed'));
      const { result } = renderHook(() => useConversationImport());
      const file = jsonFile({
        version: 5,
        history: [makeConversation()],
        folders: [],
      });

      await act(async () => {
        await result.current.importConversations(file);
      });

      expect(console.error).toHaveBeenCalled();
      const loggedArgs = (console.error as unknown as Mock).mock.calls.flat();
      const serialized = JSON.stringify(loggedArgs);
      expect(serialized).not.toMatch(/token|cookie/i);
    });
  });
});
