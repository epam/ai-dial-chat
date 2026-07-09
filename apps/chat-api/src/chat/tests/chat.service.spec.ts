import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ChatService } from '../chat.service';
import { ChatCompletionDto, ChatMessageRole } from '../dto/chat-completion.dto';

const dto: ChatCompletionDto = {
  deployment: 'gpt-4',
  messages: [{ role: ChatMessageRole.User, content: 'Hello' }],
};

const TOKEN = 'test-token';

function makeService(sendChatCompletionRequest: ReturnType<typeof vi.fn>) {
  const dialClient = {
    client: { sendChatCompletionRequest },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;
  return new ChatService(dialClient);
}

describe('ChatService', () => {
  let service: ChatService;
  let sendChatCompletionRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendChatCompletionRequest = vi.fn();
    service = makeService(sendChatCompletionRequest);
  });

  afterEach(() => vi.restoreAllMocks());

  it('returns completion on success', async () => {
    const responseBody = { choices: [{ message: { content: 'Hi' } }] };
    sendChatCompletionRequest.mockResolvedValue({
      data: responseBody,
      error: undefined,
      response: { ok: true, status: 200 },
    });

    const result = await service.sendCompletion(dto, TOKEN);
    expect(result).toEqual(responseBody);
    expect(sendChatCompletionRequest).toHaveBeenCalledWith(
      'gpt-4',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
  });

  it('throws NotFoundException when DIAL Core returns error with 404 status', async () => {
    sendChatCompletionRequest.mockResolvedValue({
      data: undefined,
      error: { status: 404 },
      response: { ok: false, status: 404 },
    });

    await expect(service.sendCompletion(dto, TOKEN)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException from response.status when the error body carries no status', async () => {
    sendChatCompletionRequest.mockResolvedValue({
      data: undefined,
      error: { message: 'Resource not found' },
      response: { ok: false, status: 404 },
    });

    await expect(service.sendCompletion(dto, TOKEN)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ServiceUnavailableException on network error', async () => {
    sendChatCompletionRequest.mockRejectedValue(new TypeError('fetch failed'));

    await expect(service.sendCompletion(dto, TOKEN)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws BadGatewayException on unexpected error', async () => {
    sendChatCompletionRequest.mockRejectedValue({ weird: 'error' });

    await expect(service.sendCompletion(dto, TOKEN)).rejects.toThrow(
      BadGatewayException,
    );
  });
});
