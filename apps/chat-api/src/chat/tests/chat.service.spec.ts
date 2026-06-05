import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentVariables } from '../../config/environment.config';
import { ChatService } from '../chat.service';
import { ChatCompletionDto } from '../dto/chat-completion.dto';

function makeService() {
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'DIAL_API_VERSION') return '2024-10-21';
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;
  return new ChatService(configService);
}

const dto: ChatCompletionDto = {
  messages: [{ role: 'user', content: 'Hello' }],
};

describe('ChatService', () => {
  it('returns completion on success', async () => {
    const service = makeService();
    const response = { choices: [] };
    vi.spyOn(service['client'], 'sendChatCompletionRequest').mockResolvedValue(
      response as never,
    );

    const result = await service.sendCompletion('gpt-4', dto);
    expect(result).toEqual(response);
    expect(service['client'].sendChatCompletionRequest).toHaveBeenCalledWith(
      'gpt-4',
      {
        body: dto,
        params: { query: { 'api-version': '2024-10-21' } },
      },
    );
  });

  it('throws ServiceUnavailableException on network error', async () => {
    const service = makeService();
    vi.spyOn(service['client'], 'sendChatCompletionRequest').mockRejectedValue(
      new TypeError('fetch failed'),
    );

    await expect(service.sendCompletion('gpt-4', dto)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws NotFoundException on 404', async () => {
    const service = makeService();
    vi.spyOn(service['client'], 'sendChatCompletionRequest').mockRejectedValue({
      status: 404,
    });

    await expect(service.sendCompletion('unknown', dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadGatewayException on unexpected error', async () => {
    const service = makeService();
    vi.spyOn(service['client'], 'sendChatCompletionRequest').mockRejectedValue({
      weird: 'error',
    });

    await expect(service.sendCompletion('gpt-4', dto)).rejects.toThrow(
      BadGatewayException,
    );
  });
});
