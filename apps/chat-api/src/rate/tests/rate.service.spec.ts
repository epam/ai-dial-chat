import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import { MessageRating } from '../../domain/message-rating';
import type { RateMessageDto } from '../dto/rate-message.dto';
import { RateService } from '../rate.service';

const BASE_URL = 'http://dial-core';
const ACCESS_TOKEN = 'test-token';

function makeService() {
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'DIAL_CORE_URL') return BASE_URL;
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;

  return new RateService(configService);
}

const validDto: RateMessageDto = {
  conversationId: 'bucket/conv-id',
  responseId: 'msg-456',
  modelId: 'anthropic.claude-v3-sonnet',
  rate: MessageRating.Like,
};

describe('RateService', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rateMessage', () => {
    it('calls the correct DIAL Core URL', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();

      await service.rateMessage(validDto, ACCESS_TOKEN);

      const expectedUrl = `${BASE_URL}/v1/${encodeURIComponent(validDto.modelId)}/rate`;
      expect(fetchSpy).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('sends the correct JSON body with numeric rate for like', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();

      await service.rateMessage(validDto, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toMatchObject({
        rate: 1,
        modelId: validDto.modelId,
        conversationId: validDto.conversationId,
        responseId: validDto.responseId,
      });
    });

    it('sends numeric rate -1 for dislike', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();
      const dislikeDto: RateMessageDto = {
        ...validDto,
        rate: MessageRating.Dislike,
      };

      await service.rateMessage(dislikeDto, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toMatchObject({ rate: -1 });
    });

    it('sends Bearer authorization header', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();

      await service.rateMessage(validDto, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe(`Bearer ${ACCESS_TOKEN}`);
    });

    it('includes optional comment when provided', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();
      const dtoWithComment = { ...validDto, comment: 'Too short' };

      await service.rateMessage(dtoWithComment, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toMatchObject({
        comment: 'Too short',
      });
    });

    it('omits comment field when not provided', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();

      await service.rateMessage(validDto, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).not.toHaveProperty('comment');
    });

    it('throws ServiceUnavailableException on network error', async () => {
      fetchSpy.mockRejectedValue(
        Object.assign(new TypeError('fetch failed'), {
          message: 'ECONNREFUSED',
        }),
      );
      const service = makeService();

      await expect(service.rateMessage(validDto, ACCESS_TOKEN)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws BadGatewayException on DIAL Core server error', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 } as Response);
      const service = makeService();

      await expect(service.rateMessage(validDto, ACCESS_TOKEN)).rejects.toThrow(
        BadGatewayException,
      );
    });
  });
});
