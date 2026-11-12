import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import type { DialModelDto } from '../../../openapi/openapi-response.dto';
import {
  MODEL_CATALOG_CACHE_TTL_MS,
  ModelCatalogService,
} from '../../catalog/model-catalog.service';
import type { ModelCatalogListResponseDto } from '../../dto/model-catalog-response.dto';

const CATALOG_KEY = 'catalog-secret-key';

const gpt: DialModelDto = { id: 'gpt-4o', object: 'model' };
const claude: DialModelDto = { id: 'claude-opus', object: 'model' };
const catalog: ModelCatalogListResponseDto = { data: [gpt, claude] };

const okResponse = (data: unknown) =>
  ({ data, response: { ok: true, status: 200 } as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { ok: false, status } as Response }) as never;

const makeService = (
  { apiKey }: { apiKey: string | undefined } = { apiKey: CATALOG_KEY },
) => {
  const getModels = vi.fn();
  const getModel = vi.fn();
  const dialClient = {
    client: { getModels, getModel },
  } as unknown as DialClientService;
  const configService = {
    get: vi.fn((key: string) =>
      key === 'MODEL_CATALOG_API_KEY' ? apiKey : undefined,
    ),
  } as unknown as ConfigService<EnvironmentVariables>;
  const service = new ModelCatalogService(dialClient, configService);
  return { service, getModels, getModel };
};

/* Every argument any Logger method received during the test, flattened. */
const loggedText = (spies: ReturnType<typeof vi.spyOn>[]): string =>
  spies
    .flatMap((spy) => spy.mock.calls.flat())
    .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
    .join('\n');

describe('ModelCatalogService', () => {
  let loggerSpies: ReturnType<typeof vi.spyOn>[];

  beforeEach(() => {
    vi.clearAllMocks();
    loggerSpies = (['log', 'debug', 'warn', 'error', 'verbose'] as const).map(
      (method) =>
        vi.spyOn(Logger.prototype, method).mockImplementation(() => undefined),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('listCatalog', () => {
    it('returns 404 without calling DIAL Core when the key is unset', async () => {
      const { service, getModels } = makeService({ apiKey: undefined });

      await expect(service.listCatalog()).rejects.toThrow(NotFoundException);
      expect(getModels).not.toHaveBeenCalled();
    });

    it('returns 404 without calling DIAL Core when the key is blank', async () => {
      const { service, getModels } = makeService({ apiKey: '   ' });

      await expect(service.listCatalog()).rejects.toThrow(NotFoundException);
      expect(getModels).not.toHaveBeenCalled();
    });

    it('sends the trimmed key as Api-Key and no Authorization header', async () => {
      const { service, getModels } = makeService({
        apiKey: ` ${CATALOG_KEY} `,
      });
      getModels.mockResolvedValue(okResponse(catalog));

      await service.listCatalog();

      expect(getModels).toHaveBeenCalledWith({
        headers: { 'Api-Key': CATALOG_KEY },
      });
    });

    it('passes the Core list body through unchanged', async () => {
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(okResponse(catalog));

      await expect(service.listCatalog()).resolves.toEqual(catalog);
    });

    it('keeps the list for 5 minutes', async () => {
      vi.useFakeTimers();
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(okResponse(catalog));

      await service.listCatalog();
      vi.advanceTimersByTime(MODEL_CATALOG_CACHE_TTL_MS - 1);
      await service.listCatalog();

      expect(MODEL_CATALOG_CACHE_TTL_MS).toBe(300_000);
      expect(getModels).toHaveBeenCalledOnce();
    });

    it('drops invocation settings and unknown fields from each entry', async () => {
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(
        okResponse({
          data: [
            {
              ...gpt,
              display_name: 'GPT-4o',
              pricing: { unit: 'token', prompt: '1', completion: '2' },
              defaults: { system_prompt: 'internal instructions' },
              responses_defaults: { temperature: 0 },
              max_retry_attempts: 3,
              tokenizer_model: 'gpt-4',
              upstreams: [{ key: 'upstream-secret' }],
            },
          ],
        }),
      );

      const result = await service.listCatalog();

      expect(result).toEqual({
        data: [
          {
            ...gpt,
            display_name: 'GPT-4o',
            pricing: { unit: 'token', prompt: '1', completion: '2' },
          },
        ],
      });
    });

    it('drops entries without a string id', async () => {
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(
        okResponse({ data: [gpt, null, { object: 'model' }, claude] }),
      );

      await expect(service.listCatalog()).resolves.toEqual(catalog);
    });

    it.each([
      ['no data field', {}],
      ['a non-array data field', { data: 'gpt-4o' }],
      ['a null body', null],
    ])(
      'returns 502 and caches nothing for a body with %s',
      async (_label, body) => {
        const { service, getModels } = makeService();
        getModels
          .mockResolvedValueOnce(okResponse(body))
          .mockResolvedValueOnce(okResponse(catalog));

        await expect(service.listCatalog()).rejects.toThrow(
          BadGatewayException,
        );
        await expect(service.listCatalog()).resolves.toEqual(catalog);
        expect(getModels).toHaveBeenCalledTimes(2);
      },
    );

    it('serves later calls from the shared cache entry', async () => {
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(okResponse(catalog));

      await service.listCatalog();
      const second = await service.listCatalog();

      expect(second).toEqual(catalog);
      expect(getModels).toHaveBeenCalledOnce();
    });

    it('calls DIAL Core again once the TTL has passed', async () => {
      vi.useFakeTimers();
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(okResponse(catalog));

      await service.listCatalog();
      vi.advanceTimersByTime(MODEL_CATALOG_CACHE_TTL_MS + 1);
      await service.listCatalog();

      expect(getModels).toHaveBeenCalledTimes(2);
    });

    it('makes one DIAL Core call for concurrent cold-cache requests', async () => {
      const { service, getModels } = makeService();
      let resolveCore: (value: unknown) => void = () => undefined;
      getModels.mockReturnValue(
        new Promise((resolve) => {
          resolveCore = resolve;
        }),
      );

      const pending = Array.from({ length: 10 }, () => service.listCatalog());
      resolveCore(okResponse(catalog));
      const results = await Promise.all(pending);

      expect(getModels).toHaveBeenCalledOnce();
      expect(results).toEqual(Array.from({ length: 10 }, () => catalog));
    });

    it('shares one failed DIAL Core call across concurrent requests and caches nothing', async () => {
      const { service, getModels } = makeService();
      getModels
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(okResponse(catalog));

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => service.listCatalog()),
      );

      expect(getModels).toHaveBeenCalledOnce();
      for (const result of results) {
        expect(result.status).toBe('rejected');
        expect((result as PromiseRejectedResult).reason).toBeInstanceOf(
          ServiceUnavailableException,
        );
      }
      await expect(service.listCatalog()).resolves.toEqual(catalog);
      expect(getModels).toHaveBeenCalledTimes(2);
    });

    it('retries DIAL Core on the next call after a failure', async () => {
      const { service, getModels } = makeService();
      getModels
        .mockResolvedValueOnce(errResponse(500))
        .mockResolvedValueOnce(okResponse(catalog));

      await expect(service.listCatalog()).rejects.toThrow(BadGatewayException);
      await expect(service.listCatalog()).resolves.toEqual(catalog);
      expect(getModels).toHaveBeenCalledTimes(2);
    });

    it.each([401, 403])(
      'returns 503 when DIAL Core answers %i for the catalog key',
      async (status) => {
        const { service, getModels } = makeService();
        getModels.mockResolvedValue(errResponse(status));

        await expect(service.listCatalog()).rejects.toThrow(
          ServiceUnavailableException,
        );
      },
    );

    it('maps a DIAL Core 404 to 404', async () => {
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(errResponse(404));

      await expect(service.listCatalog()).rejects.toThrow(NotFoundException);
    });

    it('maps a DIAL Core 429 to 429', async () => {
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(errResponse(429));

      const error = await service.listCatalog().catch((err: unknown) => err);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    });

    it('maps a DIAL Core 400 to 400', async () => {
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(errResponse(400));

      await expect(service.listCatalog()).rejects.toThrow(BadRequestException);
    });

    it('maps a DIAL Core 500 to 502', async () => {
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(errResponse(500));

      await expect(service.listCatalog()).rejects.toThrow(BadGatewayException);
    });

    it('maps a network failure to 503', async () => {
      const { service, getModels } = makeService();
      getModels.mockRejectedValue(new TypeError('fetch failed'));

      await expect(service.listCatalog()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('never writes the key to a log line on any outcome', async () => {
      const { service, getModels } = makeService();
      getModels
        .mockResolvedValueOnce(errResponse(401))
        .mockResolvedValueOnce(errResponse(403))
        .mockResolvedValueOnce(errResponse(429))
        .mockResolvedValueOnce(errResponse(500))
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(okResponse(catalog));

      for (let attempt = 0; attempt < 6; attempt += 1) {
        await service.listCatalog().catch(() => undefined);
      }
      await service.listCatalog();

      const text = loggedText(loggerSpies);
      expect(text).not.toBe('');
      expect(text).not.toContain(CATALOG_KEY);
    });
  });

  describe('getCatalogEntry', () => {
    it('returns the entry whose id matches', async () => {
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(okResponse(catalog));

      await expect(service.getCatalogEntry('claude-opus')).resolves.toEqual(
        claude,
      );
    });

    it('returns 404 for a model that is not in the catalog', async () => {
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(okResponse(catalog));

      await expect(service.getCatalogEntry('secret-model')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns 404 without calling DIAL Core when the key is unset', async () => {
      const { service, getModels, getModel } = makeService({
        apiKey: undefined,
      });

      await expect(service.getCatalogEntry('gpt-4o')).rejects.toThrow(
        NotFoundException,
      );
      expect(getModels).not.toHaveBeenCalled();
      expect(getModel).not.toHaveBeenCalled();
    });

    it('fetches the list once on a cold cache and shares it with the list route', async () => {
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(okResponse(catalog));

      await service.getCatalogEntry('gpt-4o');
      await service.getCatalogEntry('claude-opus');
      await service.listCatalog();

      expect(getModels).toHaveBeenCalledOnce();
    });

    it('never calls the per-model DIAL Core lookup', async () => {
      const { service, getModels, getModel } = makeService();
      getModels.mockResolvedValue(okResponse(catalog));

      await service.getCatalogEntry('gpt-4o');
      await service.getCatalogEntry('secret-model').catch(() => undefined);

      expect(getModel).not.toHaveBeenCalled();
    });

    it('returns the list failure unchanged', async () => {
      const { service, getModels } = makeService();
      getModels.mockResolvedValue(errResponse(401));

      await expect(service.getCatalogEntry('gpt-4o')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
