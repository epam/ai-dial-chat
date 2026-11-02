import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
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
import { AppConfigController } from '../app-config.controller';
import { AppConfigService } from '../app-config.service';
import { CompositeConfigProvider } from '../config-registry/composite-config.provider';

const ASR_RESPONSE = {
  appId: 'chat-ui',
  features: { asrEnabled: true },
  config: {
    asrModelId: 'whisper-1',
    transcribeSizeLimitBytes: 10_485_760,
    dialCoreExternalUrl: null,
  },
  metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
};

const DEFAULT_RESPONSE = {
  appId: 'chat-ui',
  features: { asrEnabled: false },
  config: {
    asrModelId: null,
    transcribeSizeLimitBytes: 5_242_880,
    dialCoreExternalUrl: null,
  },
  metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
};

const EXTERNAL_URL_RESPONSE = {
  appId: 'chat-ui',
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
          .get('/v1/client-config?appId=chat-ui')
          .expect(200);
        expect(result.body.config.activeEventId).toBe(activeEventId);
      },
    );

    it('returns 200 with ASR configured response', async () => {
      mockService.getClientConfig.mockResolvedValue(ASR_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .expect(200);

      expect(result.body.appId).toBe('chat-ui');
      expect(result.body.features.asrEnabled).toBe(true);
      expect(result.body.config.asrModelId).toBe('whisper-1');
    });

    it('returns 200 with defaults when ASR is absent', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
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
        .get('/v1/client-config?appId=chat-ui')
        .expect(200);

      expect(result.headers['cache-control']).toBe('private, no-store');
    });

    it('returns 400 when appId is missing', async () => {
      await request(app.getHttpServer()).get('/v1/client-config').expect(400);
    });

    it('returns 400 when appId is unknown', async () => {
      await request(app.getHttpServer())
        .get('/v1/client-config?appId=unknown-app')
        .expect(400);
    });

    it('response does not contain server-only keys', async () => {
      mockService.getClientConfig.mockResolvedValue(ASR_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .expect(200);

      const body = result.body as Record<string, unknown>;
      expect(body).not.toHaveProperty('userId');
      expect(body).not.toHaveProperty('roles');
      expect(body).not.toHaveProperty('environment');
    });

    it('evaluates an anonymous caller without a user id or roles', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .expect(200);

      expect(mockService.getClientConfig).toHaveBeenCalledWith({
        appId: 'chat-ui',
        userId: undefined,
        roles: undefined,
      });
    });

    it("reads session roles through the provider's rolesClaim", async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .set(
          SESSION_USER_HEADER,
          sessionHeader({ claims: { dial_roles: ['R'], roles: ['ignored'] } }),
        )
        .expect(200);

      expect(mockService.getClientConfig).toHaveBeenCalledWith({
        appId: 'chat-ui',
        userId: 'user-1',
        roles: ['R'],
      });
    });

    it('reads a dotted rolesClaim nested in a header-token payload', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .set(
          SESSION_USER_HEADER,
          sessionHeader({
            providerId: 'nested',
            claims: { realm_access: { roles: ['R', 7] } },
          }),
        )
        .expect(200);

      expect(mockService.getClientConfig).toHaveBeenCalledWith({
        appId: 'chat-ui',
        userId: 'user-1',
        roles: ['R', '7'],
      });
    });

    it('evaluates a session of an unknown provider with no roles', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .set(
          SESSION_USER_HEADER,
          sessionHeader({ providerId: 'gone', claims: { roles: ['R'] } }),
        )
        .expect(200);

      expect(mockService.getClientConfig).toHaveBeenCalledWith({
        appId: 'chat-ui',
        userId: 'user-1',
        roles: [],
      });
    });

    it('returns 200 with dialCoreExternalUrl when configured', async () => {
      mockService.getClientConfig.mockResolvedValue(EXTERNAL_URL_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .expect(200);

      expect(result.body.config.dialCoreExternalUrl).toBe(
        'https://dial.example.com',
      );
    });

    it('returns null dialCoreExternalUrl when not configured', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .expect(200);

      expect(result.body.config.dialCoreExternalUrl).toBeNull();
    });

    it('never leaks the internal DIAL_CORE_URL value', async () => {
      mockService.getClientConfig.mockResolvedValue(EXTERNAL_URL_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
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
    ]);
    return app;
  };

  const getConfig = (server: INestApplication, roles?: string[]) => {
    const pending = request(server.getHttpServer()).get(
      '/v1/client-config?appId=chat-ui',
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
