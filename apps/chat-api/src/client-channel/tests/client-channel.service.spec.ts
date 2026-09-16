import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ClientChannelService } from '../client-channel.service';
import {
  ReportClientChannelDto,
  ToolsetSigninResult,
} from '../dto/report-client-channel.dto';

const okResponse = (data: unknown = {}) =>
  ({ data, response: { status: 200 } as Response }) as never;

const errResponse = (status: number, error: unknown = {}) =>
  ({ error, response: { status } as Response }) as never;

function makeDeps() {
  const dialClient = {
    client: {
      subscribeClientChannel: vi.fn(),
      reportClientChannel: vi.fn(),
      unsubscribeClientChannel: vi.fn(),
    },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  return { dialClient };
}

describe('ClientChannelService', () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: ClientChannelService;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = makeDeps();
    service = new ClientChannelService(deps.dialClient);
  });

  describe('subscribe', () => {
    it('returns the stream and channel id on a fresh subscribe', async () => {
      const stream = new ReadableStream<Uint8Array>();
      vi.mocked(
        deps.dialClient.client.subscribeClientChannel,
      ).mockResolvedValue({
        response: new Response(stream, {
          status: 200,
          headers: { 'X-DIAL-CLIENT-CHANNEL-ID': 'channel-1' },
        }),
      } as never);

      const result = await service.subscribe(
        'token',
        undefined,
        new AbortController().signal,
      );

      expect(result.channelId).toBe('channel-1');
      expect(result.stream).toBeInstanceOf(ReadableStream);
      expect(
        deps.dialClient.client.subscribeClientChannel,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
    });

    it('forwards the reconnect channel id header', async () => {
      const stream = new ReadableStream<Uint8Array>();
      vi.mocked(
        deps.dialClient.client.subscribeClientChannel,
      ).mockResolvedValue({
        response: new Response(stream, {
          status: 200,
          headers: { 'X-DIAL-CLIENT-CHANNEL-ID': 'channel-1' },
        }),
      } as never);

      await service.subscribe(
        'token',
        'channel-1',
        new AbortController().signal,
      );

      expect(
        deps.dialClient.client.subscribeClientChannel,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-DIAL-CLIENT-CHANNEL-ID': 'channel-1',
          }),
        }),
      );
    });

    it('throws BadGatewayException when Core rejects the subscription', async () => {
      vi.mocked(
        deps.dialClient.client.subscribeClientChannel,
      ).mockResolvedValue({
        response: new Response(null, { status: 502 }),
      } as never);

      await expect(
        service.subscribe('token', undefined, new AbortController().signal),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('throws when Core omits the channel id header', async () => {
      vi.mocked(
        deps.dialClient.client.subscribeClientChannel,
      ).mockResolvedValue({
        response: new Response(new ReadableStream(), { status: 200 }),
      } as never);

      await expect(
        service.subscribe('token', undefined, new AbortController().signal),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('throws ServiceUnavailableException when the fetch itself fails', async () => {
      vi.mocked(
        deps.dialClient.client.subscribeClientChannel,
      ).mockRejectedValue(new Error('network down'));

      await expect(
        service.subscribe('token', undefined, new AbortController().signal),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('report', () => {
    const body: ReportClientChannelDto = {
      id: 'event-1',
      result: ToolsetSigninResult.Success,
    };

    it('forwards a success report to DIAL Core', async () => {
      vi.mocked(deps.dialClient.client.reportClientChannel).mockResolvedValue(
        okResponse(),
      );

      await service.report('token', 'channel-1', body);

      expect(deps.dialClient.client.reportClientChannel).toHaveBeenCalledWith({
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'X-DIAL-CLIENT-CHANNEL-ID': 'channel-1',
        }),
        body: { jsonrpc: '2.0', id: 'event-1', result: 'success' },
      });
    });

    it('throws BadGatewayException when Core returns an error', async () => {
      vi.mocked(deps.dialClient.client.reportClientChannel).mockResolvedValue(
        errResponse(502),
      );

      await expect(
        service.report('token', 'channel-1', body),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('unsubscribe', () => {
    it('unsubscribes successfully', async () => {
      vi.mocked(
        deps.dialClient.client.unsubscribeClientChannel,
      ).mockResolvedValue(okResponse());

      await expect(service.unsubscribe('token', 'channel-1')).resolves.toBe(
        200,
      );

      expect(
        deps.dialClient.client.unsubscribeClientChannel,
      ).toHaveBeenCalledWith({
        headers: expect.objectContaining({
          'X-DIAL-CLIENT-CHANNEL-ID': 'channel-1',
        }),
      });
    });

    it.each([204, 400, 401, 403, 404, 429, 500, 502, 503])(
      'preserves Core HTTP status %i',
      async (status) => {
        vi.mocked(
          deps.dialClient.client.unsubscribeClientChannel,
        ).mockResolvedValue(
          status < 400
            ? ({ response: new Response(null, { status }) } as never)
            : errResponse(status),
        );

        await expect(service.unsubscribe('token', 'channel-1')).resolves.toBe(
          status,
        );
      },
    );

    it('preserves an error status even when the Core response has an empty body', async () => {
      vi.mocked(
        deps.dialClient.client.unsubscribeClientChannel,
      ).mockResolvedValue({
        response: new Response(null, { status: 500 }),
        error: '',
      } as never);

      await expect(service.unsubscribe('token', 'channel-1')).resolves.toBe(
        500,
      );
    });

    it('returns an unavailable error when Core cannot be reached', async () => {
      vi.mocked(
        deps.dialClient.client.unsubscribeClientChannel,
      ).mockRejectedValue(new TypeError('fetch failed'));

      await expect(
        service.unsubscribe('token', 'channel-1'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
