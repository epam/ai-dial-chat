import type { Attachment, Conversation } from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
  MessageRole,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadFile } from '../../../server-api/files.api';
import { attachmentsToDtos } from '../../../utils/attachment-to-dto';
import { useConversationHandlers } from '../useConversationHandlers';

vi.mock('../../../utils/attachment-to-dto', () => ({
  attachmentsToDtos: vi.fn(),
}));
vi.mock('../../../utils/build-upload-path', () => ({
  buildUploadPath: vi.fn(
    (attachment: { name: string }) => `uploads/${attachment.name}`,
  ),
}));
vi.mock('../../../server-api/files.api', () => ({
  uploadFile: vi.fn(),
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(() => ({ selectedItemId: 'selected-deployment' })),
}));
vi.mock('../../../server-api/conversations.api', () => ({
  deleteConversation: vi.fn(),
  saveConversation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../server-api/rate.api', () => ({
  rateMessage: vi.fn().mockResolvedValue(undefined),
}));

const mockAttachmentsToDtos = vi.mocked(attachmentsToDtos);
const mockUploadFile = vi.mocked(uploadFile);

const makeConversation = (): Conversation =>
  ({
    id: 'conv-1',
    name: 'Test',
    model: { id: 'gpt-4o' },
    messages: [],
    folderId: '',
    prompt: '',
    temperature: 0,
    lastActivityDate: Date.now(),
    updatedAt: Date.now(),
    selectedAddons: [],
    assistantModelId: '',
  }) as Conversation;

const makeAttachment = (): Attachment => ({
  id: 'att-1',
  name: 'file.pdf',
  contentType: 'application/pdf',
  file: new File(['content'], 'file.pdf', { type: 'application/pdf' }),
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  url: 'https://example.com/file.pdf',
});

const makeParams = (overrides?: object) => {
  const conversation = makeConversation();
  const conversationRef = { current: conversation };
  const startStream = vi.fn();
  const setConversation = vi.fn();
  const navigate = vi.fn();

  return {
    conversation,
    conversationId: 'conv-1',
    bucket: 'user-bucket',
    isStreaming: false,
    startStream,
    conversationRef,
    setConversation,
    navigate,
    ...overrides,
  };
};

describe('useConversationHandlers — handleSend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads an attachment immediately through the files API', async () => {
    const attachment = makeAttachment();
    mockUploadFile.mockResolvedValue({ url: 'https://example.com/file.pdf' });
    const params = makeParams();
    const { result } = renderHook(() => useConversationHandlers(params));

    await expect(
      result.current.handleUploadAttachment(attachment),
    ).resolves.toBe('https://example.com/file.pdf');

    expect(mockUploadFile).toHaveBeenCalledWith(
      'user-bucket',
      'uploads/file.pdf',
      attachment.file,
    );
  });

  it('calls startStream with url-based DTOs from already uploaded attachments', async () => {
    const attachment = makeAttachment();
    mockAttachmentsToDtos.mockReturnValue([
      {
        type: 'application/pdf',
        title: 'file.pdf',
        url: 'https://example.com/file.pdf',
      },
    ]);
    const params = makeParams();
    const { result } = renderHook(() => useConversationHandlers(params));

    await result.current.handleSend('hello', [attachment]);

    expect(params.startStream).toHaveBeenCalled();
    const customContent = params.startStream.mock.calls[0][4];
    expect(customContent?.attachments?.[0].url).toBe(
      'https://example.com/file.pdf',
    );
  });

  it('calls startStream with the selected deployment', async () => {
    mockAttachmentsToDtos.mockReturnValue(undefined);
    const params = makeParams();
    const { result } = renderHook(() => useConversationHandlers(params));

    await result.current.handleSend('hello', []);

    expect(params.startStream).toHaveBeenCalledWith(
      'conv-1',
      'hello',
      1,
      'selected-deployment',
      { attachments: undefined },
    );
  });

  it('does not call startStream when attachment DTO mapping rejects', async () => {
    const attachment = makeAttachment();
    mockAttachmentsToDtos.mockImplementation(() => {
      throw new Error('attachment not uploaded');
    });
    const params = makeParams();
    const { result } = renderHook(() => useConversationHandlers(params));

    await expect(
      result.current.handleSend('hello', [attachment]),
    ).rejects.toThrow('attachment not uploaded');
    expect(params.startStream).not.toHaveBeenCalled();
  });

  it('calls startStream without attachments field when no attachments are provided', async () => {
    mockAttachmentsToDtos.mockReturnValue(undefined);
    const params = makeParams();
    const { result } = renderHook(() => useConversationHandlers(params));

    await result.current.handleSend('hello', []);

    expect(params.startStream).toHaveBeenCalled();
    const customContent = params.startStream.mock.calls[0][4];
    expect(customContent?.attachments).toBeUndefined();
  });

  it('calls startStream for text-only send when bucket is empty', async () => {
    mockAttachmentsToDtos.mockReturnValue(undefined);
    const params = makeParams({ bucket: '' });
    const { result } = renderHook(() => useConversationHandlers(params));

    await result.current.handleSend('hello', []);

    expect(params.startStream).toHaveBeenCalled();
    expect(mockAttachmentsToDtos).toHaveBeenCalledWith([]);
  });

  it('returns early when conversationId is undefined', async () => {
    const params = makeParams({ conversationId: undefined });
    const { result } = renderHook(() => useConversationHandlers(params));

    await result.current.handleSend('hello', []);

    expect(params.startStream).not.toHaveBeenCalled();
  });
});

describe('useConversationHandlers — handleRegenerateMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes messages after the regenerated response before streaming', () => {
    const conversation = {
      ...makeConversation(),
      messages: [
        { role: MessageRole.User, content: 'First question' },
        {
          role: MessageRole.Assistant,
          content: 'First answer',
          custom_content: { stages: [] },
          wasStoppedByUser: true,
          stoppedWithoutContent: true,
          hasStreamError: true,
        },
        { role: MessageRole.User, content: 'Follow-up question' },
        { role: MessageRole.Assistant, content: 'Follow-up answer' },
      ],
    } as Conversation;
    const conversationRef = { current: conversation };
    const params = makeParams({ conversation, conversationRef });
    const { result } = renderHook(() => useConversationHandlers(params));

    act(() => result.current.handleRegenerateMessage(1));

    const updateConversation = params.setConversation.mock.calls[0][0] as (
      previous: Conversation,
    ) => Conversation;
    const updated = updateConversation(conversation);

    expect(updated.messages).toEqual([
      conversation.messages[0],
      {
        role: MessageRole.Assistant,
        content: '',
        custom_content: undefined,
        wasStoppedByUser: undefined,
        stoppedWithoutContent: undefined,
        hasStreamError: undefined,
      },
    ]);
    expect(conversationRef.current).toBe(updated);
    expect(params.startStream).toHaveBeenCalledWith(
      'conv-1',
      'First question',
      1,
      'selected-deployment',
      undefined,
    );
  });

  it('preserves the bucket and nested application path when starting a stream', async () => {
    mockAttachmentsToDtos.mockReturnValue(undefined);
    const params = makeParams({
      conversationId:
        'user-bucket/applications/catalog/Untitled%20app%201__0.0.1__hello',
    });
    const { result } = renderHook(() => useConversationHandlers(params));

    await result.current.handleSend('hello', []);

    expect(params.startStream).toHaveBeenCalledWith(
      'user-bucket/applications/catalog/Untitled app 1__0.0.1__hello',
      'hello',
      1,
      'selected-deployment',
      { attachments: undefined },
    );
  });
});
