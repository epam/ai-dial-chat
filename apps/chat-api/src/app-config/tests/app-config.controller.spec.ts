import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
  VersioningType,
  type Provider,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderRegistryService } from '../../auth/providers/provider-registry.service';
import { OptionalSessionGuard } from '../../auth/session/optional-session.guard';
import type { SessionUser } from '../../auth/session/session.types';
import { UserRolesService } from '../../auth/user-roles.service';
import {
  CATALOG_CREATION_TYPES,
  CatalogCreationType,
  type CatalogCreationRolesConfig,
} from '../../config/catalog-creation.types';
import type { EnvironmentVariables } from '../../config/environment.config';
import { ExplicitEnvironment } from '../../config/explicit-environment';
import { validate } from '../../config/validation';
import { AppConfigController } from '../app-config.controller';
import { AppConfigService } from '../app-config.service';
import { CompositeConfigProvider } from '../config-registry/composite-config.provider';
import { EnvConfigProvider } from '../config-registry/env-config.provider';
import { StaticDefaultsProvider } from '../config-registry/static-defaults.provider';
import { ManagedConfigProvider } from '../managed-runtime/managed-config.provider';
import { ManagedRuntimeService } from '../managed-runtime/managed-runtime.service';
import { RuntimeReadKind } from '../managed-runtime/snapshot-reader';
import {
  candidate,
  createFakeClock,
  createFakeReader,
  createInertManagedRuntime,
  type FakeReader,
  snapshotBody,
} from './managed-runtime/managed-runtime.fixtures';

const ASR_RESPONSE = {
  appId: 'ai-dial-chat',
  features: { asrEnabled: true },
  config: {
    asrModelId: 'whisper-1',
    transcribeSizeLimitBytes: 10_485_760,
    dialCoreExternalUrl: null,
  },
  metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
};

const DEFAULT_RESPONSE = {
  appId: 'ai-dial-chat',
  features: { asrEnabled: false },
  config: {
    asrModelId: null,
    transcribeSizeLimitBytes: 5_242_880,
    dialCoreExternalUrl: null,
  },
  metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
};

const EXTERNAL_URL_RESPONSE = {
  appId: 'ai-dial-chat',
  features: { asrEnabled: false },
  config: {
    asrModelId: null,
    transcribeSizeLimitBytes: 5_242_880,
    dialCoreExternalUrl: 'https://dial.example.com',
  },
  metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
};

const SESSION_USER_HEADER = 'x-test-session-user';

/* Providers known to the stub registry; `dial_roles` is the claim a real
 * provider configures by default. */
const PROVIDER_CONFIGS: Record<string, { rolesClaim?: string }> = {
  keycloak: { rolesClaim: 'dial_roles' },
  nested: { rolesClaim: 'realm_access.roles' },
};

const registryStub = {
  getProvider: (providerId: string) => {
    const config = PROVIDER_CONFIGS[providerId];
    if (!config) {
      throw new Error('Unknown provider');
    }
    return { client: {}, config };
  },
} as unknown as ProviderRegistryService;

const sessionHeader = (user: Partial<SessionUser>) =>
  JSON.stringify({
    sub: 'user-1',
    providerId: 'keycloak',
    claims: {},
    ...user,
  });

function makeApp() {
  const mockService = {
    getClientConfig: vi.fn(),
  };
  return { mockService };
}

async function buildApp(
  appConfigProviders: Provider[],
): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers: [AppConfigController],
    providers: [
      ...appConfigProviders,
      { provide: ProviderRegistryService, useValue: registryStub },
      UserRolesService,
    ],
  })
    .overrideGuard(OptionalSessionGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = module.createNestApplication();
  /* Stands in for OptionalSessionGuard attaching the session user. */
  app.use(
    (
      req: { headers: Record<string, unknown>; user?: unknown },
      _res: unknown,
      next: () => void,
    ) => {
      const header = req.headers[SESSION_USER_HEADER];
      if (typeof header === 'string') {
        req.user = JSON.parse(header);
      }
      next();
    },
  );
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  await app.listen(0, '127.0.0.1');
  return app;
}

describe('AppConfigController (integration)', () => {
  let app: INestApplication;
  let mockService: ReturnType<typeof makeApp>['mockService'];

  beforeEach(async () => {
    ({ mockService } = makeApp());
    app = await buildApp([
      { provide: AppConfigService, useValue: mockService },
    ]);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /v1/client-config', () => {
    it.each(['halloween', 'new-year', 'product-launch-2027', null])(
      'returns event selection %s in the public client configuration',
      async (activeEventId) => {
        mockService.getClientConfig.mockResolvedValue({
          ...DEFAULT_RESPONSE,
          config: { ...DEFAULT_RESPONSE.config, activeEventId },
        });
        const result = await request(app.getHttpServer())
          .get('/v1/client-config?appId=ai-dial-chat')
          .expect(200);
        expect(result.body.config.activeEventId).toBe(activeEventId);
      },
    );

    it('returns 200 with ASR configured response', async () => {
      mockService.getClientConfig.mockResolvedValue(ASR_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=ai-dial-chat')
        .expect(200);

      expect(result.body.appId).toBe('ai-dial-chat');
      expect(result.body.features.asrEnabled).toBe(true);
      expect(result.body.config.asrModelId).toBe('whisper-1');
    });

    it('returns 200 with defaults when ASR is absent', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=ai-dial-chat')
        .expect(200);

      expect(result.body.features.asrEnabled).toBe(false);
      expect(result.body.config.asrModelId).toBeNull();
      expect(result.body.config.transcribeSizeLimitBytes).toBe(5_242_880);
    });

    /* A cached response keeps serving the previous deployment's announcements
       and feature flags after a redeploy ([#8827](https://github.com/epam/ai-dial-chat/issues/8827)). */
    it('forbids caching the response', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=ai-dial-chat')
        .expect(200);

      expect(result.headers['cache-control']).toBe('private, no-store');
    });

    it.each(['chat-ui', 'ai-dial-chat'])(
      'evaluates appId=%s as ai-dial-chat',
      async (appId) => {
        mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

        const result = await request(app.getHttpServer())
          .get(`/v1/client-config?appId=${appId}`)
          .expect(200);

        expect(result.body.appId).toBe('ai-dial-chat');
        expect(mockService.getClientConfig).toHaveBeenCalledWith(
          expect.objectContaining({ appId: 'ai-dial-chat' }),
        );
      },
    );

    it('returns 400 when appId is missing', async () => {
      await request(app.getHttpServer()).get('/v1/client-config').expect(400);
    });

    /* A well-formed identifier passes the DTO; the service decides whether
     * this deployment serves it. */
    it('returns 400 when appId is unknown', async () => {
      mockService.getClientConfig.mockRejectedValue(
        new BadRequestException('Unknown appId'),
      );

      await request(app.getHttpServer())
        .get('/v1/client-config?appId=unknown-app')
        .expect(400);
    });

    it('returns 400 when appId is repeated', async () => {
      await request(app.getHttpServer())
        .get('/v1/client-config?appId=ai-dial-chat&appId=ai-dial-chat')
        .expect(400);
      expect(mockService.getClientConfig).not.toHaveBeenCalled();
    });

    it('response does not contain server-only keys', async () => {
      mockService.getClientConfig.mockResolvedValue(ASR_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=ai-dial-chat')
        .expect(200);

      const body = result.body as Record<string, unknown>;
      expect(body).not.toHaveProperty('userId');
      expect(body).not.toHaveProperty('roles');
      expect(body).not.toHaveProperty('environment');
    });

    it('evaluates an anonymous caller without a user id or roles', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      await request(app.getHttpServer())
        .get('/v1/client-config?appId=ai-dial-chat')
        .expect(200);

      expect(mockService.getClientConfig).toHaveBeenCalledWith({
        appId: 'ai-dial-chat',
        userId: undefined,
        roles: undefined,
      });
    });

    it("reads session roles through the provider's rolesClaim", async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      await request(app.getHttpServer())
        .get('/v1/client-config?appId=ai-dial-chat')
        .set(
          SESSION_USER_HEADER,
          sessionHeader({ claims: { dial_roles: ['R'], roles: ['ignored'] } }),
        )
        .expect(200);

      expect(mockService.getClientConfig).toHaveBeenCalledWith({
        appId: 'ai-dial-chat',
        userId: 'user-1',
        roles: ['R'],
      });
    });

    it('reads a dotted rolesClaim nested in a header-token payload', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      await request(app.getHttpServer())
        .get('/v1/client-config?appId=ai-dial-chat')
        .set(
          SESSION_USER_HEADER,
          sessionHeader({
            providerId: 'nested',
            claims: { realm_access: { roles: ['R', 7] } },
          }),
        )
        .expect(200);

      expect(mockService.getClientConfig).toHaveBeenCalledWith({
        appId: 'ai-dial-chat',
        userId: 'user-1',
        roles: ['R', '7'],
      });
    });

    it('evaluates a session of an unknown provider with no roles', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      await request(app.getHttpServer())
        .get('/v1/client-config?appId=ai-dial-chat')
        .set(
          SESSION_USER_HEADER,
          sessionHeader({ providerId: 'gone', claims: { roles: ['R'] } }),
        )
        .expect(200);

      expect(mockService.getClientConfig).toHaveBeenCalledWith({
        appId: 'ai-dial-chat',
        userId: 'user-1',
        roles: [],
      });
    });

    it('returns 200 with dialCoreExternalUrl when configured', async () => {
      mockService.getClientConfig.mockResolvedValue(EXTERNAL_URL_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=ai-dial-chat')
        .expect(200);

      expect(result.body.config.dialCoreExternalUrl).toBe(
        'https://dial.example.com',
      );
    });

    it('returns null dialCoreExternalUrl when not configured', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=ai-dial-chat')
        .expect(200);

      expect(result.body.config.dialCoreExternalUrl).toBeNull();
    });

    it('never leaks the internal DIAL_CORE_URL value', async () => {
      mockService.getClientConfig.mockResolvedValue(EXTERNAL_URL_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=ai-dial-chat')
        .expect(200);

      expect(JSON.stringify(result.body)).not.toContain('DIAL_CORE_URL');
    });
  });
});

/*
 * The real AppConfigService behind the real controller: only the registry
 * providers and the cache store are stubs, so the serialized permission
 * object is exactly what a browser receives.
 */
describe('AppConfigController catalogCreationPermissions (integration)', () => {
  const POLICY: CatalogCreationRolesConfig = {
    types: { 'custom-app': ['developers'] },
    schemas: {
      'https://example.test/schemas/Runner-A': ['team-A'],
      'schema-B': ['team-B', 'admins'],
    },
  };

  let app: INestApplication | undefined;

  const buildRealApp = async ({
    policy = POLICY,
    enabledUiFeatures,
  }: {
    policy?: CatalogCreationRolesConfig;
    enabledUiFeatures?: string[];
  } = {}) => {
    const cacheStore = new Map<string, unknown>();
    app = await buildApp([
      AppConfigService,
      {
        provide: CompositeConfigProvider,
        useValue: {
          resolve: vi.fn(async (key: string) =>
            key === 'uiFeatures.enabledUiFeatures'
              ? enabledUiFeatures
              : undefined,
          ),
        },
      },
      {
        provide: CACHE_MANAGER,
        useValue: {
          get: async (key: string) => cacheStore.get(key),
          set: async (key: string, value: unknown) => {
            cacheStore.set(key, value);
          },
        },
      },
      {
        provide: ConfigService,
        useValue: new ConfigService({ CATALOG_CREATION_ROLES: policy }),
      },
      { provide: ExplicitEnvironment, useValue: ExplicitEnvironment.of([]) },
      { provide: ManagedRuntimeService, useValue: createInertManagedRuntime() },
    ]);
    return app;
  };

  const getConfig = (server: INestApplication, roles?: string[]) => {
    const pending = request(server.getHttpServer()).get(
      '/v1/client-config?appId=ai-dial-chat',
    );
    return roles === undefined
      ? pending
      : pending.set(
          SESSION_USER_HEADER,
          sessionHeader({ claims: { dial_roles: roles } }),
        );
  };

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('allows every type when no policy is configured', async () => {
    const server = await buildRealApp({ policy: {} });

    const result = await getConfig(server, ['anyone']).expect(200);

    expect(result.body.config.catalogCreationPermissions).toEqual({
      allowedTypes: [...CATALOG_CREATION_TYPES],
      restrictedSchemaIds: [],
    });
  });

  it('grants a caller holding the required roles', async () => {
    const server = await buildRealApp();

    const result = await getConfig(server, [
      'developers',
      'team-A',
      'admins',
    ]).expect(200);

    expect(result.body.config.catalogCreationPermissions).toEqual({
      allowedTypes: [...CATALOG_CREATION_TYPES],
      restrictedSchemaIds: [],
    });
  });

  it('denies a caller without the required roles, reporting exact schema ids', async () => {
    const server = await buildRealApp();

    const result = await getConfig(server, ['team-a']).expect(200);

    expect(result.body.config.catalogCreationPermissions).toEqual({
      allowedTypes: CATALOG_CREATION_TYPES.filter(
        (type) => type !== CatalogCreationType.CustomApp,
      ),
      restrictedSchemaIds: [
        'https://example.test/schemas/Runner-A',
        'schema-B',
      ],
    });
  });

  it('evaluates an anonymous caller with no roles', async () => {
    const server = await buildRealApp();

    const result = await getConfig(server).expect(200);

    expect(result.body.config.catalogCreationPermissions).toEqual({
      allowedTypes: CATALOG_CREATION_TYPES.filter(
        (type) => type !== CatalogCreationType.CustomApp,
      ),
      restrictedSchemaIds: [
        'https://example.test/schemas/Runner-A',
        'schema-B',
      ],
    });
  });

  it('always serializes both arrays, even when empty', async () => {
    const server = await buildRealApp({
      policy: {
        types: Object.fromEntries(
          CATALOG_CREATION_TYPES.map((type) => [type, ['nobody']]),
        ),
      },
    });

    const result = await getConfig(server, []).expect(200);

    expect(result.body.config.catalogCreationPermissions).toEqual({
      allowedTypes: [],
      restrictedSchemaIds: [],
    });
  });

  it('leaks no role names, raw policy maps, or caller roles', async () => {
    const server = await buildRealApp();

    const result = await getConfig(server, ['secret-caller-role']).expect(200);
    const serialized = JSON.stringify(result.body);

    for (const role of ['developers', 'team-A', 'team-B', 'admins']) {
      expect(serialized).not.toContain(role);
    }
    expect(serialized).not.toContain('secret-caller-role');
    expect(serialized).not.toContain('CATALOG_CREATION_ROLES');
    expect(result.body.config.catalogCreationPermissions).not.toHaveProperty(
      'types',
    );
    expect(result.body.config.catalogCreationPermissions).not.toHaveProperty(
      'schemas',
    );
  });

  it('keeps appId validation and the no-store header', async () => {
    const server = await buildRealApp();

    await request(server.getHttpServer()).get('/v1/client-config').expect(400);
    await request(server.getHttpServer())
      .get('/v1/client-config?appId=unknown-app')
      .expect(400);
    const result = await getConfig(server).expect(200);
    expect(result.headers['cache-control']).toBe('private, no-store');
  });

  it.each([
    ['the null default baseline', undefined, null],
    [
      'an explicit baseline',
      ['header', 'custom-apps'],
      ['header', 'custom-apps'],
    ],
  ])(
    'returns the same enabledUiFeatures to allowed and denied callers for %s',
    async (_label, configured, expected) => {
      const server = await buildRealApp({ enabledUiFeatures: configured });

      const allowed = await getConfig(server, ['developers']).expect(200);
      const denied = await getConfig(server, []).expect(200);

      expect(allowed.body.config.enabledUiFeatures).toEqual(expected);
      expect(denied.body.config.enabledUiFeatures).toEqual(expected);
      expect(allowed.body.config.catalogCreationPermissions).not.toEqual(
        denied.body.config.catalogCreationPermissions,
      );
    },
  );
});

/*
 * The real AppConfigService behind the real controller and ValidationPipe:
 * the DTO checks the identifier's format, the service checks it against the
 * deployment's CLIENT_CONFIG_APP_IDS.
 */
describe('AppConfigController served application identifiers (integration)', () => {
  let app: INestApplication | undefined;
  let cacheStore: Map<string, unknown>;

  const buildServingApp = async (servedAppIds?: string[]) => {
    cacheStore = new Map<string, unknown>();
    app = await buildApp([
      AppConfigService,
      {
        provide: CompositeConfigProvider,
        useValue: {
          resolve: vi.fn(async (key: string) =>
            key === 'asr.modelId' ? 'whisper-1' : undefined,
          ),
        },
      },
      {
        provide: CACHE_MANAGER,
        useValue: {
          get: async (key: string) => cacheStore.get(key),
          set: async (key: string, value: unknown) => {
            cacheStore.set(key, value);
          },
        },
      },
      {
        provide: ConfigService,
        useValue: new ConfigService({ CLIENT_CONFIG_APP_IDS: servedAppIds }),
      },
      { provide: ExplicitEnvironment, useValue: ExplicitEnvironment.of([]) },
      { provide: ManagedRuntimeService, useValue: createInertManagedRuntime() },
    ]);
    return app;
  };

  const getConfig = (server: INestApplication, appId: string) =>
    request(server.getHttpServer())
      .get('/v1/client-config')
      .query({ appId })
      .set(
        SESSION_USER_HEADER,
        sessionHeader({ claims: { dial_roles: ['R'] } }),
      );

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it.each(['Chat_UI', '-x', `a${'b'.repeat(63)}`, 'chat ui'])(
    'rejects the malformed identifier %j with a validation message',
    async (appId) => {
      const server = await buildServingApp(['ai-dial-chat', 'launchpad']);

      const result = await getConfig(server, appId).expect(400);

      expect(JSON.stringify(result.body.message)).toContain('appId must be');
      expect(cacheStore.size).toBe(0);
    },
  );

  it('rejects a repeated identifier', async () => {
    const server = await buildServingApp();

    await request(server.getHttpServer())
      .get('/v1/client-config?appId=ai-dial-chat&appId=ai-dial-chat')
      .expect(400);
  });

  it('serves only ai-dial-chat with the default list', async () => {
    const server = await buildServingApp();

    await getConfig(server, 'ai-dial-chat').expect(200);
    const result = await getConfig(server, 'launchpad').expect(400);

    expect(result.body.message).toBe('Unknown appId');
  });

  it('serves every listed identifier with the same values and its own appId', async () => {
    const server = await buildServingApp(['launchpad', 'ai-dial-chat']);

    const launchpad = await getConfig(server, 'launchpad').expect(200);
    const chat = await getConfig(server, 'ai-dial-chat').expect(200);
    await getConfig(server, 'models-garden').expect(400);

    expect(launchpad.body.appId).toBe('launchpad');
    expect(chat.body.appId).toBe('ai-dial-chat');
    expect(launchpad.body.config.asrModelId).toBe('whisper-1');
    expect(launchpad.body.features).toEqual(chat.body.features);
    expect(launchpad.body.config).toEqual(chat.body.config);
  });

  it('keeps a separate cache entry per identifier', async () => {
    const server = await buildServingApp(['launchpad', 'ai-dial-chat']);

    await getConfig(server, 'launchpad').expect(200);
    await getConfig(server, 'ai-dial-chat').expect(200);
    const cachedLaunchpad = await getConfig(server, 'launchpad').expect(200);

    expect([...cacheStore.keys()]).toEqual([
      'app-config:client:launchpad:user:user-1:roles:R',
      'app-config:client:ai-dial-chat:user:user-1:roles:R',
    ]);
    expect(cachedLaunchpad.body.appId).toBe('launchpad');
  });

  it('keeps the no-store header for another served identifier', async () => {
    const server = await buildServingApp(['launchpad', 'ai-dial-chat']);

    const result = await getConfig(server, 'launchpad').expect(200);

    expect(result.headers['cache-control']).toBe('private, no-store');
  });
});

/*
 * The real resolution stack — environment, managed and default providers —
 * behind the real controller, over a fake Core reader and a fake clock.
 */
describe('AppConfigController managed configuration (integration)', () => {
  const REQUIRED = {
    DIAL_CORE_URL: 'https://dial-core.example.com',
    AUTH_SESSION_SECRET: 'a'.repeat(64),
    AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
  };
  const MANAGED = {
    MANAGED_CONFIG_INSTANCES: 'ai-dial-chat=chat-dev,launchpad=launchpad-dev',
    CLIENT_CONFIG_APP_IDS: 'ai-dial-chat,launchpad',
    MANAGED_CONFIG_API_KEY: 'reader-key',
    MANAGED_CONFIG_MAX_STALENESS_SECONDS: '900',
  };
  /* Published order is the tour order: it is neither sorted nor grouped by
   * target. The repeated id is valid under the schema; Chat keeps the first. */
  const TOUR = [
    {
      id: 'tour.composer',
      target: 'conversation-input',
      title: '  Ask anything  ',
      description: 'Type a question or attach files.',
    },
    { id: 'tour.new-chat', target: 'new-chat', title: 'Start a new chat' },
    { id: 'tour.composer', target: 'catalog', title: 'Repeated id' },
    { id: 'tour.catalog', target: 'catalog', title: 'Browse the catalog' },
  ];
  const NORMALIZED_TOUR = [
    {
      id: 'tour.composer',
      target: 'conversation-input',
      title: 'Ask anything',
      description: 'Type a question or attach files.',
      pages: [],
    },
    {
      id: 'tour.new-chat',
      target: 'new-chat',
      title: 'Start a new chat',
      description: null,
      pages: [],
    },
    {
      id: 'tour.catalog',
      target: 'catalog',
      title: 'Browse the catalog',
      description: null,
      pages: [],
    },
  ];
  const CHAT_PAYLOAD = {
    config: { 'onboarding.hints': TOUR },
    features: {},
  };
  const LAUNCHPAD_BODY = snapshotBody({
    instanceId: 'launchpad-dev',
    appId: 'launchpad',
    schemaVersion: '2.0.0',
    schemaSha256: 'b'.repeat(64),
    revisionId: '20261120T090000000Z-fedcba9876543210',
    payload: { blocks: [{ id: 'news' }] },
  });

  let app: INestApplication | undefined;
  let runtime: ManagedRuntimeService | undefined;
  let cacheSets: { key: string; ttl: number }[];

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    runtime?.onModuleDestroy();
    await app?.close();
    app = undefined;
    runtime = undefined;
    vi.restoreAllMocks();
  });

  const buildManagedApp = async (
    raw: Record<string, unknown>,
    respond: (fake: FakeReader) => void = () => undefined,
  ) => {
    const configService = new ConfigService<EnvironmentVariables>(
      validate({ ...REQUIRED, ...raw }),
    );
    const clock = createFakeClock();
    const fake = createFakeReader();
    respond(fake);
    runtime = new ManagedRuntimeService(configService, fake.reader, clock);
    await runtime.onApplicationBootstrap();
    const cacheStore = new Map<string, unknown>();
    cacheSets = [];
    app = await buildApp([
      AppConfigService,
      CompositeConfigProvider,
      EnvConfigProvider,
      StaticDefaultsProvider,
      ManagedConfigProvider,
      { provide: ManagedRuntimeService, useValue: runtime },
      { provide: ConfigService, useValue: configService },
      {
        provide: ExplicitEnvironment,
        useValue: ExplicitEnvironment.fromConfigService(configService),
      },
      {
        provide: CACHE_MANAGER,
        useValue: {
          get: async (key: string) => cacheStore.get(key),
          set: async (key: string, value: unknown, ttl: number) => {
            cacheSets.push({ key, ttl });
            cacheStore.set(key, value);
          },
        },
      },
    ]);
    return { clock, fake, server: app.getHttpServer() };
  };

  const respondChat = (fake: FakeReader) => {
    fake.respondAlways('chat-dev', candidate({ payload: CHAT_PAYLOAD }));
    fake.respondAlways('launchpad-dev', {
      kind: RuntimeReadKind.Candidate,
      body: LAUNCHPAD_BODY,
    });
  };

  const withoutTime = (body: Record<string, unknown>) => ({
    ...body,
    metadata: { ...(body['metadata'] as object), resolvedAt: undefined },
  });

  it('answers shadow mode exactly like off mode', async () => {
    const off = await buildManagedApp({});
    const offResponse = await request(off.server)
      .get('/v1/client-config?appId=ai-dial-chat')
      .expect(200);
    const offCache = cacheSets;
    runtime?.onModuleDestroy();
    await app?.close();

    const shadow = await buildManagedApp(
      { ...MANAGED, MANAGED_CONFIG_MODE: 'shadow' },
      respondChat,
    );
    const shadowResponse = await request(shadow.server)
      .get('/v1/client-config?appId=ai-dial-chat')
      .expect(200);

    expect(runtime?.captureView('ai-dial-chat').state).toBe('fresh');
    expect(withoutTime(shadowResponse.body)).toEqual(
      withoutTime(offResponse.body),
    );
    expect(shadowResponse.body.config.onboardingHints).toEqual([]);
    expect(shadowResponse.body).not.toHaveProperty('appConfig');
    expect(shadowResponse.body.metadata).not.toHaveProperty('managed');
    expect(shadowResponse.body.metadata).not.toHaveProperty('nextRefreshAt');
    expect(cacheSets).toEqual(offCache);
  });

  it('applies an active key and reports the managed state', async () => {
    const { server } = await buildManagedApp(
      {
        ...MANAGED,
        MANAGED_CONFIG_MODE: 'active',
        MANAGED_CONFIG_ACTIVE_KEYS: 'onboarding.hints',
      },
      respondChat,
    );

    const response = await request(server)
      .get('/v1/client-config?appId=ai-dial-chat')
      .expect(200);

    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body.config.onboardingHints).toEqual(NORMALIZED_TOUR);
    expect(response.body).not.toHaveProperty('appConfig');
    expect(response.body.metadata).toEqual({
      resolvedAt: '2026-11-20T10:00:00.000Z',
      cacheTtlSeconds: 60,
      nextRefreshAt: '2026-11-20T10:02:00.000Z',
      managed: {
        instanceId: 'chat-dev',
        state: 'fresh',
        revisionId: '20261120T095500000Z-0123456789abcdef',
        schemaVersion: '1.2.0',
        publishedAt: '2026-11-20T09:55:00.000Z',
      },
    });
    expect(cacheSets).toEqual([
      {
        key: 'app-config:client:ai-dial-chat:user:anonymous:roles:none:managed:chat-dev:20261120T095500000Z-0123456789abcdef:fresh',
        ttl: 60_000,
      },
    ]);
  });

  it('delivers the published tour in order, normalized like the environment value', async () => {
    const fromEnvironment = await buildManagedApp({
      ONBOARDING_HINTS: JSON.stringify(TOUR),
    });
    const environmentResponse = await request(fromEnvironment.server)
      .get('/v1/client-config?appId=ai-dial-chat')
      .expect(200);
    runtime?.onModuleDestroy();
    await app?.close();

    const managed = await buildManagedApp(
      {
        ...MANAGED,
        MANAGED_CONFIG_MODE: 'active',
        MANAGED_CONFIG_ACTIVE_KEYS: 'onboarding.hints',
      },
      respondChat,
    );
    const managedResponse = await request(managed.server)
      .get('/v1/client-config?appId=ai-dial-chat')
      .expect(200);

    expect(environmentResponse.body.config.onboardingHints).toEqual(
      NORMALIZED_TOUR,
    );
    expect(managedResponse.body.config.onboardingHints).toEqual(
      environmentResponse.body.config.onboardingHints,
    );
  });

  it('keeps an explicit environment value over the managed one', async () => {
    const local = [{ id: 'local', target: 'navigation', title: 'Local' }];
    const { server } = await buildManagedApp(
      {
        ...MANAGED,
        MANAGED_CONFIG_MODE: 'active',
        MANAGED_CONFIG_ACTIVE_KEYS: 'onboarding.hints',
        ONBOARDING_HINTS: JSON.stringify(local),
      },
      respondChat,
    );
    const response = await request(server)
      .get('/v1/client-config?appId=ai-dial-chat')
      .expect(200);
    expect(response.body.config.onboardingHints).toEqual([
      { ...local[0], description: null, pages: [] },
    ]);
  });

  it('delivers a foreign payload unchanged, only to its own identifier', async () => {
    const { server } = await buildManagedApp(
      { ...MANAGED, MANAGED_CONFIG_MODE: 'active' },
      respondChat,
    );

    const launchpad = await request(server)
      .get('/v1/client-config?appId=launchpad')
      .expect(200);
    const chat = await request(server)
      .get('/v1/client-config?appId=ai-dial-chat')
      .expect(200);

    expect(launchpad.body.appConfig).toEqual({
      schemaVersion: '2.0.0',
      schemaSha256: 'b'.repeat(64),
      revisionId: '20261120T090000000Z-fedcba9876543210',
      publishedAt: '2026-11-20T09:55:00.000Z',
      payload: { blocks: [{ id: 'news' }] },
    });
    expect(launchpad.body.metadata.managed.instanceId).toBe('launchpad-dev');
    expect(launchpad.body.features).toEqual(chat.body.features);
    expect(chat.body).not.toHaveProperty('appConfig');
    expect(chat.body.metadata.managed.instanceId).toBe('chat-dev');
  });

  it('never reads a foreign payload into the typed fields', async () => {
    const { server } = await buildManagedApp(
      {
        ...MANAGED,
        MANAGED_CONFIG_MODE: 'active',
        MANAGED_CONFIG_ACTIVE_KEYS: 'onboarding.hints',
      },
      (fake) => {
        fake.respondAlways('chat-dev', candidate({ payload: CHAT_PAYLOAD }));
        fake.respondAlways('launchpad-dev', {
          kind: RuntimeReadKind.Candidate,
          body: {
            ...LAUNCHPAD_BODY,
            payload: {
              config: {
                'onboarding.hints': [
                  { id: 'lp', target: 'navigation', title: 'Launchpad value' },
                ],
              },
              features: {},
            },
          },
        });
      },
    );

    const launchpad = await request(server)
      .get('/v1/client-config?appId=launchpad')
      .expect(200);
    const chat = await request(server)
      .get('/v1/client-config?appId=ai-dial-chat')
      .expect(200);

    expect(chat.body.config.onboardingHints).toEqual(NORMALIZED_TOUR);
    expect(launchpad.body.config.onboardingHints).toEqual([]);
    expect(launchpad.body.appConfig.payload.config).toEqual({
      'onboarding.hints': [
        { id: 'lp', target: 'navigation', title: 'Launchpad value' },
      ],
    });
  });

  it('withholds a foreign payload that is not usable', async () => {
    const { server } = await buildManagedApp(
      { ...MANAGED, MANAGED_CONFIG_MODE: 'active' },
      (fake) => {
        fake.respondAlways('chat-dev', candidate());
        fake.respondAlways('launchpad-dev', {
          kind: RuntimeReadKind.NotPublished,
        });
      },
    );
    const response = await request(server)
      .get('/v1/client-config?appId=launchpad')
      .expect(200);
    expect(response.body).not.toHaveProperty('appConfig');
    expect(response.body.metadata.managed).toEqual({
      instanceId: 'launchpad-dev',
      state: 'not_published',
    });
  });

  it('rejects a browser attempt to name an instance', async () => {
    const { fake, server } = await buildManagedApp(
      { ...MANAGED, MANAGED_CONFIG_MODE: 'active' },
      respondChat,
    );
    await request(server)
      .get('/v1/client-config?appId=ai-dial-chat&instance=chat-prod')
      .expect(400);
    expect(fake.calls).not.toContain('chat-prod');
  });

  it('makes no Core request per browser request', async () => {
    const { fake, server } = await buildManagedApp(
      { ...MANAGED, MANAGED_CONFIG_MODE: 'active' },
      respondChat,
    );
    const before = fake.calls.length;
    for (let index = 0; index < 5; index += 1) {
      await request(server)
        .get('/v1/client-config?appId=ai-dial-chat')
        .expect(200);
    }
    expect(fake.calls.length).toBe(before);
  });
});
