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
    beforeEach(() => {
      vi.spyOn(service['client'], 'getConversation').mockResolvedValue({
        data: TEST_CONVERSATION,
      } as never);
    });

    it('logs and delegates to handleDialError when completion stream is rejected', async () => {
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
