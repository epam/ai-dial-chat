import { MessageRole, StatusEvent } from '@epam/ai-dial-chat-shared';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { handleDialError } from '../../common/utils/dial-error';
import { ConversationService } from '../conversation.service';

vi.mock('../../common/utils/dial-error', () => ({
  handleDialError: vi.fn(),
}));

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const TEST_CONVERSATION = {
  id: 'test-bucket/gpt-4o__Test__11111111-1111-1111-1111-111111111111',
  folderId: 'test-bucket',
  name: 'Test',
  model: { id: 'gpt-4o' },
  prompt: '',
  temperature: 1,
  messages: [],
  lastActivityDate: 0,
  updatedAt: 0,
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
};

const textToStream = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
};

const readStreamText = async (
  stream: ReadableStream<Uint8Array>,
): Promise<string> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        text += decoder.decode();
        return text;
      }

      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
};

describe('ConversationService', () => {
  let service: ConversationService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'DIAL_CORE_URL') return 'http://localhost:3000';
        if (key === 'DIAL_API_KEY') return 'test-api-key';
        return undefined;
      }),
    };
    service = new ConversationService(mockConfigService as ConfigService);
    vi.mocked(handleDialError).mockReset();
    vi.spyOn(service['client'], 'saveConversation').mockResolvedValue({
      data: {},
    } as never);
  });

  describe('createConversation', () => {
    it('returns a conversation with a UUID-format id', async () => {
      const result = await service.createConversation(
        'Hello',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );
      expect(result.id).toMatch(/.*__.*/); // id format: folderId/path
    });

    it('returns a conversation with one user message containing the firstMessage content', async () => {
      const result = await service.createConversation(
        'Hello world',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello world');
    });

    it('gives the message a UUID-format id', async () => {
      const result = await service.createConversation(
        'Hello',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );
      expect(result.messages[0].id).toMatch(UUID_REGEX);
    });

    it('gives the message an ISO-8601 timestamp', async () => {
      const result = await service.createConversation(
        'Hello',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );
      expect(result.messages[0].timestamp).toMatch(ISO_REGEX);
    });

    it('generates a unique id for each conversation', async () => {
      const a = await service.createConversation(
        'First',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );
      const b = await service.createConversation(
        'Second',
        'test-token',
        'test-bucket',
        'gpt-4o',
      );
      expect(a.id).not.toBe(b.id);
    });

    it('uses deploymentId for model.id and assistantModelId', async () => {
      const result = await service.createConversation(
        'Hello',
        'test-token',
        'test-bucket',
        'my-catalog-item',
      );
      expect(result.model.id).toBe('my-catalog-item');
      expect(result.assistantModelId).toBe('my-catalog-item');
    });
  });

  describe('getConversation', () => {
    it('encodes reserved URL characters in the DIAL Core conversation path', async () => {
      const getConversationSpy = vi
        .spyOn(service['client'], 'getConversation')
        .mockResolvedValue({
          data: TEST_CONVERSATION,
        } as never);

      await service.getConversation(
        'folder/statgpt-sample__What datasets are available?__uuid',
        'test-token',
        'test-bucket',
      );

      expect(getConversationSpy).toHaveBeenCalledWith(
        'test-bucket',
        'folder/statgpt-sample__What%20datasets%20are%20available%3F__uuid',
        expect.any(Object),
      );
    });
  });

  describe('streamCompletion', () => {
    const baseConversation = {
      id: 'test-bucket/test-path',
      folderId: 'test-bucket',
      name: 'Test',
      model: { id: 'gpt-4o' },
      prompt: '',
      temperature: 1,
      selectedAddons: [],
      lastActivityDate: 0,
      updatedAt: 0,
    };

    it('excludes MessageRole.Status messages from the DIAL Core payload', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: MessageRole.User,
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 's1',
            role: MessageRole.Status,
            content: '',
            timestamp: '2024-01-01T00:00:01.000Z',
            custom_content: {
              event_type: StatusEvent.ModelChanged,
              previous_deployment_id: null,
              new_deployment_id: 'gpt-4o',
            },
          },
          {
            id: 'a1',
            role: MessageRole.Assistant,
            content: 'Hi there',
            timestamp: '2024-01-01T00:00:02.000Z',
          },
        ],
      };

      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: conversation,
      } as never);

      const mockStream = new ReadableStream();
      const sendSpy = vi
        .spyOn(service['client'], 'sendChatCompletionRequest')
        .mockResolvedValue({
          response: { ok: true, body: mockStream } as Response,
        } as never);

      await service.streamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        'Next message',
        'gpt-4o',
      );

      const sentMessages: { role: string }[] =
        sendSpy.mock.calls[0][1].body.messages;
      expect(sentMessages.some((m) => m.role === MessageRole.Status)).toBe(
        false,
      );
      expect(sentMessages.some((m) => m.role === MessageRole.User)).toBe(true);
      expect(sentMessages.some((m) => m.role === MessageRole.Assistant)).toBe(
        true,
      );
    });

    it('includes all non-status messages in the DIAL Core payload', async () => {
      const conversation = {
        ...baseConversation,
        messages: [
          {
            id: 'u1',
            role: MessageRole.User,
            content: 'First',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 's1',
            role: MessageRole.Status,
            content: '',
            timestamp: '2024-01-01T00:00:01.000Z',
            custom_content: {
              event_type: StatusEvent.ModelChanged,
              previous_deployment_id: 'old-model',
              new_deployment_id: 'gpt-4o',
            },
          },
          {
            id: 'a1',
            role: MessageRole.Assistant,
            content: 'Response',
            timestamp: '2024-01-01T00:00:02.000Z',
          },
        ],
      };

      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: conversation,
      } as never);

      const mockStream = new ReadableStream();
      const sendSpy = vi
        .spyOn(service['client'], 'sendChatCompletionRequest')
        .mockResolvedValue({
          response: { ok: true, body: mockStream } as Response,
        } as never);

      await service.streamCompletion(
        'test-path',
        'test-token',
        'test-bucket',
        'Follow-up',
        'gpt-4o',
      );

      const sentMessages: { role: string; content: string }[] =
        sendSpy.mock.calls[0][1].body.messages;
      expect(sentMessages).toHaveLength(3); // user + assistant + new user
      expect(sentMessages[0]).toMatchObject({
        role: MessageRole.User,
        content: 'First',
      });
      expect(sentMessages[1]).toMatchObject({
        role: MessageRole.Assistant,
        content: 'Response',
      });
      expect(sentMessages[2]).toMatchObject({
        role: MessageRole.User,
        content: 'Follow-up',
      });
    });

    it('logs and delegates to handleDialError when completion stream is rejected', async () => {
      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      vi.mocked(handleDialError).mockImplementation(() => {
        throw new Error('mapped DIAL error');
      });
      const logError = vi
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);
      vi.spyOn(
        service['client'],
        'sendChatCompletionRequest',
      ).mockResolvedValue({
        response: new Response(null, {
          status: 400,
          statusText: 'Bad Request',
        }),
      } as never);

      await expect(
        service.streamCompletion(
          'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
          'test-token',
          'test-bucket',
          'Hello',
          'gpt-4o',
        ),
      ).rejects.toThrow('mapped DIAL error');

      expect(logError).toHaveBeenCalled();
      expect(handleDialError).toHaveBeenCalledWith({ status: 400 });
    });

    it('passes the stream through when completion succeeds', async () => {
      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
      const firstChunk =
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
      const secondChunk = 'data: [DONE]\n\n';
      const sendCompletionSpy = vi.spyOn(
        service['client'],
        'sendChatCompletionRequest',
      );
      sendCompletionSpy.mockResolvedValue({
        response: new Response(textToStream([firstChunk, secondChunk]), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      } as never);

      const stream = await service.streamCompletion(
        'gpt-4o__Test__11111111-1111-1111-1111-111111111111',
        'test-token',
        'test-bucket',
        'Hello',
        'gpt-4o',
      );

      await expect(readStreamText(stream)).resolves.toBe(
        `${firstChunk}${secondChunk}`,
      );
      expect(sendCompletionSpy).toHaveBeenCalledWith(
        'gpt-4o',
        expect.objectContaining({
          params: { query: { 'api-version': '2024-10-21' } },
        }),
      );
      expect(handleDialError).not.toHaveBeenCalled();
    });
  });
});
