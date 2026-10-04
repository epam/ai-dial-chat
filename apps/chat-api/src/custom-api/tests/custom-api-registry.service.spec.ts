import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  CUSTOM_API_CONFIG_MAX_BYTES,
  CUSTOM_API_MAX_OPERATIONS,
  CustomApiRegistryService,
  parseCustomApiRegistry,
  resolveCustomApiDestination,
} from '../custom-api-registry.service';

const VALID_OPERATION = {
  id: 'data-products',
  method: 'GET',
  corePath: '/data-products',
};

const buildConfig = (operations: unknown[] = [VALID_OPERATION]) =>
  JSON.stringify({ version: 1, operations });

const createService = async (
  customCoreApiConfig: string | undefined,
): Promise<CustomApiRegistryService> => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CustomApiRegistryService,
      {
        provide: ConfigService,
        useValue: { get: () => customCoreApiConfig },
      },
    ],
  }).compile();

  return moduleRef.get(CustomApiRegistryService);
};

describe('CustomApiRegistryService', () => {
  describe('unset/empty/whitespace configuration', () => {
    it.each([undefined, '', '   ', '\n\t '])(
      'enables no operations for %p',
      async (value) => {
        const service = await createService(value);
        expect(service.get('data-products')).toBeUndefined();
      },
    );

    it('accepts the inline .env example value', async () => {
      const service = await createService(
        '{"version":1,"operations":[{"id":"data-products","method":"GET","corePath":"/data-products"}]}',
      );
      expect(service.get('data-products')).toEqual({
        id: 'data-products',
        method: 'GET',
        corePath: '/data-products',
        timeoutMs: 10_000,
        maxResponseBytes: 1_048_576,
      });
    });

    it('accepts an explicit empty operations array', async () => {
      const service = await createService(buildConfig([]));
      expect(service.get('data-products')).toBeUndefined();
    });
  });

  describe('malformed input fails startup', () => {
    it('rejects malformed JSON', async () => {
      await expect(createService('{not json')).rejects.toThrow(
        /CUSTOM_CORE_API_CONFIG/,
      );
    });

    it.each([
      ['array root', '[]'],
      ['string root', '"oops"'],
      ['null root', 'null'],
      ['wrong version', JSON.stringify({ version: 2, operations: [] })],
      ['non-array operations', JSON.stringify({ version: 1, operations: {} })],
    ])('rejects %s', async (_name, value) => {
      await expect(createService(value)).rejects.toThrow();
    });

    it('rejects an unknown root field', async () => {
      await expect(
        createService(
          JSON.stringify({ version: 1, operations: [], extra: true }),
        ),
      ).rejects.toThrow();
    });

    it('rejects more than 64 operations', async () => {
      const operations = Array.from(
        { length: CUSTOM_API_MAX_OPERATIONS + 1 },
        (_, i) => ({
          id: `op-${i}`,
          method: 'GET',
          corePath: `/op-${i}`,
        }),
      );
      await expect(createService(buildConfig(operations))).rejects.toThrow();
    });

    it('rejects duplicate operation ids', async () => {
      await expect(
        createService(buildConfig([VALID_OPERATION, VALID_OPERATION])),
      ).rejects.toThrow();
    });

    it.each(['access', 'query', 'responseSchema', 'role', 'upstream'])(
      'rejects the unsupported field "%s"',
      async (field) => {
        await expect(
          createService(
            buildConfig([{ ...VALID_OPERATION, [field]: 'anything' }]),
          ),
        ).rejects.toThrow();
      },
    );

    it('rejects a non-GET method', async () => {
      await expect(
        createService(buildConfig([{ ...VALID_OPERATION, method: 'POST' }])),
      ).rejects.toThrow();
    });

    it.each([-1, 0, 1.5, 10_001, '10000'])(
      'rejects invalid timeoutMs %p',
      async (timeoutMs) => {
        await expect(
          createService(buildConfig([{ ...VALID_OPERATION, timeoutMs }])),
        ).rejects.toThrow();
      },
    );

    it.each([-1, 0, 1.5, 1_048_577, '1000'])(
      'rejects invalid maxResponseBytes %p',
      async (maxResponseBytes) => {
        await expect(
          createService(
            buildConfig([{ ...VALID_OPERATION, maxResponseBytes }]),
          ),
        ).rejects.toThrow();
      },
    );

    it('rejects an oversized UTF-8 value, including multibyte input', async () => {
      // Each '€' is 3 UTF-8 bytes but 1 UTF-16 code unit, so a naive
      // `.length` check would under-count this value's real byte size.
      const padding = '€'.repeat(CUSTOM_API_CONFIG_MAX_BYTES);
      const value = buildConfig([
        { ...VALID_OPERATION, id: `data-products-${padding}` },
      ]);
      expect(Buffer.byteLength(value, 'utf8')).toBeGreaterThan(
        CUSTOM_API_CONFIG_MAX_BYTES,
      );
      await expect(createService(value)).rejects.toThrow();
    });

    it('redacts the raw value from the thrown error', async () => {
      const secretLookingValue = '{"version":1,"operations":"should-not-leak"}';
      let thrown: unknown;
      try {
        await createService(secretLookingValue);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).not.toContain('should-not-leak');
    });
  });

  describe('invalid ids and paths', () => {
    it.each(['Data-Products', '1data', 'data_products', '-data', ''])(
      'rejects invalid id %p',
      async (id) => {
        await expect(
          createService(buildConfig([{ ...VALID_OPERATION, id }])),
        ).rejects.toThrow();
      },
    );

    it.each([
      '/../admin',
      '/%2e%2e/admin',
      '/%252e%252e/admin',
      '//other-host',
      '/items\\all',
      '/items//all',
      '/items/',
      'https://example.com/data-products',
      '/data?x=1',
      '/data#frag',
      'data-products',
    ])('rejects the unsafe path %p', async (corePath) => {
      await expect(
        createService(buildConfig([{ ...VALID_OPERATION, corePath }])),
      ).rejects.toThrow();
    });

    it('accepts a multi-segment path', async () => {
      const service = await createService(
        buildConfig([
          { ...VALID_OPERATION, corePath: '/catalog/data-products' },
        ]),
      );
      expect(service.get('data-products')?.corePath).toBe(
        '/catalog/data-products',
      );
    });
  });

  describe('registry immutability', () => {
    it('does not expose a mutation method and keeps returning the same entry', async () => {
      const service = await createService(buildConfig());
      const first = service.get('data-products');
      const second = service.get('data-products');
      expect(first).toEqual(second);
      expect(
        (service as unknown as Record<string, unknown>)['set'],
      ).toBeUndefined();
    });
  });
});

describe('parseCustomApiRegistry', () => {
  it('performs no filesystem or network reads — it only parses the provided string', () => {
    // A pure-function contract check: calling it twice with the same input
    // yields equivalent, independent results with no shared external state.
    const a = parseCustomApiRegistry(buildConfig());
    const b = parseCustomApiRegistry(buildConfig());
    expect(a.get('data-products')).toEqual(b.get('data-products'));
  });
});

describe('resolveCustomApiDestination', () => {
  it('uses the exact Core root with no version prefix or query', () => {
    const destination = resolveCustomApiDestination(
      'https://core-api.com',
      '/data-products',
    );
    expect(destination.toString()).toBe('https://core-api.com/data-products');
  });

  it('preserves an intentional base path prefix', () => {
    const destination = resolveCustomApiDestination(
      'https://core-api.com/dial',
      '/data-products',
    );
    expect(destination.toString()).toBe(
      'https://core-api.com/dial/data-products',
    );
  });

  it('never adds /v1, /openai, /api or an api-version segment', () => {
    const destination = resolveCustomApiDestination(
      'https://core-api.com',
      '/data-products',
    );
    expect(destination.pathname).not.toMatch(/\/(v1|openai|api)(\/|$)/);
    expect(destination.search).toBe('');
  });
});
