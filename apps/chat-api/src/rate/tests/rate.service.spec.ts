import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { MessageRating } from '../dto/rate-message.dto';
import type { RateMessageDto } from '../dto/rate-message.dto';
import { RateService } from '../rate.service';

const BASE_URL = 'http://dial-core';
const ACCESS_TOKEN = 'test-token';
let fetchSpy: ReturnType<typeof vi.fn>;

function makeService() {
  const dialClient = {
    client: {},
    baseUrl: BASE_URL,
    dialApiVersion: '2024-10-21',
    fetchCore: fetchSpy,
  } as unknown as DialClientService;

  return new RateService(dialClient);
}

const validDto: RateMessageDto = {
  conversationId: 'bucket/conv-id',
  responseId: 'msg-456',
  modelId: 'anthropic.claude-v3-sonnet',
  rate: MessageRating.Like,
};

describe('RateService', () => {
  beforeEach(() => {
    fetchSpy = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rateMessage', () => {
    it('calls the correct DIAL Core URL', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();

      await service.rateMessage(validDto, ACCESS_TOKEN);

      const expectedUrl = `${BASE_URL}/v1/${validDto.modelId}/rate`;
      expect(fetchSpy).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('keeps literal "/" path segments for a custom app deployment id instead of percent-encoding them', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();
      const appDto: RateMessageDto = {
        ...validDto,
        modelId: 'applications/bucket/My%20App__1.0',
      };

      await service.rateMessage(appDto, ACCESS_TOKEN);

      const expectedUrl = `${BASE_URL}/v1/applications/bucket/My%20App__1.0/rate`;
      expect(fetchSpy).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('sends a boolean rate: true to DIAL Core for like, with no modelId or conversationId in the body', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();

      await service.rateMessage(validDto, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toStrictEqual({
        responseId: validDto.responseId,
        rate: true,
      });
    });

    it('sends a boolean rate: false to DIAL Core for dislike', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();
      const dislikeDto: RateMessageDto = {
        ...validDto,
        rate: MessageRating.Dislike,
      };

      await service.rateMessage(dislikeDto, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toStrictEqual({
        responseId: dislikeDto.responseId,
        rate: false,
      });
    });

    it('sends a boolean rate: false to DIAL Core when clearing a rating', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();
      const clearDto: RateMessageDto = { ...validDto, rate: null };

      await service.rateMessage(clearDto, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toStrictEqual({
        responseId: clearDto.responseId,
        rate: false,
      });
    });

    it('sends Bearer authorization header', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();

      await service.rateMessage(validDto, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe(`Bearer ${ACCESS_TOKEN}`);
    });

    it('forwards the conversation id in the X-CONVERSATION-ID header', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();

      await service.rateMessage(validDto, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-CONVERSATION-ID']).toBe(validDto.conversationId);
    });

    it('percent-encodes non-Latin-1 characters in the X-CONVERSATION-ID header', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();
      const unicodeDto = {
        ...validDto,
        conversationId: 'bucket/gpt-4o__Привет — 🙂__uuid',
      };

      await service.rateMessage(unicodeDto, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-CONVERSATION-ID']).toBe(
        'bucket/gpt-4o__%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82 %E2%80%94 %F0%9F%99%82__uuid',
      );
      expect(decodeURIComponent(headers['X-CONVERSATION-ID'])).toBe(
        unicodeDto.conversationId,
      );
    });

    it('forwards the job title in the X-JOB-TITLE header when provided', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();

      await service.rateMessage(
        validDto,
        ACCESS_TOKEN,
        'Lead Software Engineer',
      );

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-JOB-TITLE']).toBe('Lead Software Engineer');
    });

    it('omits the X-JOB-TITLE header when no job title is provided', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();

      await service.rateMessage(validDto, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers).not.toHaveProperty('X-JOB-TITLE');
    });

    it.each([
      { rate: MessageRating.Like, expectedRate: true },
      { rate: MessageRating.Dislike, expectedRate: false },
      { rate: null, expectedRate: false },
    ])(
      'forwards the comment to DIAL Core for rate $rate',
      async ({ rate, expectedRate }) => {
        fetchSpy.mockResolvedValue({ ok: true } as Response);
        const service = makeService();
        const comment = 'Some comment';

        await service.rateMessage({ ...validDto, rate, comment }, ACCESS_TOKEN);

        const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
        expect(JSON.parse(init.body as string)).toStrictEqual({
          responseId: validDto.responseId,
          rate: expectedRate,
          comment,
        });
      },
    );

    it('preserves an explicitly empty comment', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = makeService();

      await service.rateMessage({ ...validDto, comment: '' }, ACCESS_TOKEN);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toStrictEqual({
        responseId: validDto.responseId,
        rate: true,
        comment: '',
      });
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
