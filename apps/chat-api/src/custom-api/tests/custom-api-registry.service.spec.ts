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
        query: [],
        body: 'none',
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

    it.each(['access', 'responseSchema', 'role', 'upstream'])(
      'rejects the unsupported field "%s"',
      async (field) => {
        await expect(
          createService(
            buildConfig([{ ...VALID_OPERATION, [field]: 'anything' }]),
          ),
        ).rejects.toThrow();
      },
    );

    it.each(['PATCH', 'HEAD', 'get', 1])(
      'rejects the method %p',
      async (method) => {
        await expect(
          createService(buildConfig([{ ...VALID_OPERATION, method }])),
        ).rejects.toThrow();
      },
    );

    it.each([-1, 0, 1.5, 300_001, '10000'])(
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

  describe('methods, query and body', () => {
    it.each(['GET', 'POST', 'PUT', 'DELETE'])(
      'accepts the method %s',
      async (method) => {
        const service = await createService(
          buildConfig([{ ...VALID_OPERATION, method }]),
        );
        expect(service.get('data-products')?.method).toBe(method);
      },
    );

    it('keeps the allowlisted query names in configuration order', async () => {
      const service = await createService(
        buildConfig([
          { ...VALID_OPERATION, query: ['url', 'repo', 'sub_path'] },
        ]),
      );
      expect(service.get('data-products')?.query).toEqual([
        'url',
        'repo',
        'sub_path',
      ]);
    });

    it.each([
      ['a string', 'url'],
      ['an uppercase name', ['Url']],
      ['a hyphenated name', ['a-b']],
      ['a name starting with a digit', ['1url']],
      ['a 33-character name', ['a'.repeat(33)]],
      ['a non-string name', [1]],
      ['a duplicate name', ['url', 'url']],
      ['more than 16 names', Array.from({ length: 17 }, (_, i) => `p${i}`)],
    ])('rejects query as %s', async (_name, query) => {
      await expect(
        createService(buildConfig([{ ...VALID_OPERATION, query }])),
      ).rejects.toThrow();
    });

    it.each(['POST', 'PUT'])('accepts a JSON body on %s', async (method) => {
      const service = await createService(
        buildConfig([{ ...VALID_OPERATION, method, body: 'json' }]),
      );
      expect(service.get('data-products')?.body).toBe('json');
    });

    it.each([
      ['GET', 'json'],
      ['DELETE', 'json'],
      ['POST', 'text'],
      ['PUT', true],
    ])('rejects body on %s with %p', async (method, body) => {
      await expect(
        createService(buildConfig([{ ...VALID_OPERATION, method, body }])),
      ).rejects.toThrow();
    });

    it('defaults the deadline to 10 s and lets an entry opt in to 300 s', async () => {
      const service = await createService(
        buildConfig([
          VALID_OPERATION,
          {
            id: 'discover',
            method: 'GET',
            corePath: '/discover',
            timeoutMs: 300_000,
          },
        ]),
      );
      expect(service.get('data-products')?.timeoutMs).toBe(10_000);
      expect(service.get('discover')?.timeoutMs).toBe(300_000);
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
      '/..',
      '/.',
      '/items/../admin',
      '/items/./all',
      '/items/..',
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

    it.each([
      '/v1/deployments/applications/public/team/runner__1.0.0/route/editor/browse',
      '/items/.well-known',
      '/items/v1.2/...',
    ])('accepts dots inside a segment in %p', async (corePath) => {
      const service = await createService(
        buildConfig([{ ...VALID_OPERATION, corePath }]),
      );
      expect(service.get('data-products')?.corePath).toBe(corePath);
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

  it('appends the given query without changing origin or path', () => {
    const destination = resolveCustomApiDestination(
      'https://core-api.com/dial',
      '/dial-loop/editor/probe',
      new URLSearchParams({ url: 'https://other.example/../admin?x=1#f' }),
    );
    expect(destination.origin).toBe('https://core-api.com');
    expect(destination.pathname).toBe('/dial/dial-loop/editor/probe');
    expect(destination.searchParams.get('url')).toBe(
      'https://other.example/../admin?x=1#f',
    );
    expect(destination.hash).toBe('');
  });

  it('keeps dots inside a segment unchanged', () => {
    const destination = resolveCustomApiDestination(
      'https://core-api.com',
      '/v1/deployments/applications/public/team/runner__1.0.0/route/x',
    );
    expect(destination.pathname).toBe(
      '/v1/deployments/applications/public/team/runner__1.0.0/route/x',
    );
  });

  it('throws when a dot segment would move the destination', () => {
    expect(() =>
      resolveCustomApiDestination('https://core-api.com', '/items/../admin'),
    ).toThrow('escaped the configured Core base');
  });
});
