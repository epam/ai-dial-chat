import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { ApplicationPublishCopyService } from '../application-publish-copy.service';
import { ApplicationPublishPreparationService } from '../application-publish-preparation.service';
import { ApplicationDependencyResolver } from '../dependencies/application-dependency.resolver';
import { PublishDependenciesService } from '../dependencies/publish-dependencies.service';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import { PublishResultDto } from '../dto/publish-result.dto';
import { VersionPublicationStatus } from '../dto/version-status-entry.dto';
import { OrgUnitCopyService } from '../org-unit-copy.service';
import { PublishController } from '../publish.controller';
import { PublishService } from '../publish.service';
import { resolveVersionStatus } from '../version-status.util';
import { VersionStatusesService } from '../version-statuses.service';

const TEST_USER = {
  sub: 'user-123',
  at: 'test-access-token',
  bucket: 'bucket-123',
  claims: { name: 'Test User' },
};

const publishResult: PublishResultDto = {
  entityId: 'tool-abc123',
  entityType: CatalogEntityType.Toolset,
  folderPath: 'Organization/Data Science',
  version: '1.2.0',
  publishedAt: '2026-07-13T10:00:00.000Z',
  publishedBy: 'user@example.com',
};

async function buildApp(
  service: unknown,
  versionStatusesService: unknown = {},
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [PublishController],
    providers: [
      { provide: OrgUnitCopyService, useValue: {} },
      { provide: PublishService, useValue: service },
      { provide: VersionStatusesService, useValue: versionStatusesService },
    ],
  })
    .overrideGuard(FeatureGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = module.createNestApplication();
  app.use(
    (
      req: Express.Request & { user?: unknown },
      _res: unknown,
      next: () => void,
    ) => {
      req.user = TEST_USER;
      next();
    },
  );
  app.setGlobalPrefix('api');
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

describe('PublishController (integration)', () => {
  let app: INestApplication;
  let service: {
    publish: ReturnType<typeof vi.fn>;
    getPublishHistory: ReturnType<typeof vi.fn>;
    checkPublishTarget: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      publish: vi.fn().mockResolvedValue(publishResult),
      getPublishHistory: vi.fn().mockResolvedValue([publishResult]),
      checkPublishTarget: vi.fn().mockResolvedValue({ taken: true }),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/catalog/:entityType/:entityId/publish-target', () => {
    it('delegates to the service with the caller token and returns the answer', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/application/app__1.0.0/publish-target')
        .query({ folderPath: 'Organization/Data Science', version: '2.0.0' })
        .expect(200);

      expect(res.body).toEqual({ taken: true });
      expect(service.checkPublishTarget).toHaveBeenCalledWith(
        TEST_USER.at,
        'application',
        'app__1.0.0',
        'Organization/Data Science',
        '2.0.0',
      );
    });

    it('accepts a request without a version', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/catalog/prompt/greet/publish-target')
        .query({ folderPath: 'Org' })
        .expect(200);

      expect(service.checkPublishTarget).toHaveBeenCalledWith(
        TEST_USER.at,
        'prompt',
        'greet',
        'Org',
        undefined,
      );
    });

    it.each([
      ['a missing folderPath', {}],
      ['a path traversal in folderPath', { folderPath: '../secret' }],
      ['a version outside the charset', { folderPath: 'Org', version: 'a b' }],
      ['an unknown query parameter', { folderPath: 'Org', extra: '1' }],
    ])('rejects %s before the service', async (_label, query) => {
      await request(app.getHttpServer())
        .get('/api/v1/catalog/application/app__1.0.0/publish-target')
        .query(query)
        .expect(400);

      expect(service.checkPublishTarget).not.toHaveBeenCalled();
    });

    it('rejects an unknown entity type', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/catalog/widget/x/publish-target')
        .query({ folderPath: 'Org' })
        .expect(400);
    });

    it('passes a Core failure through as its mapped status', async () => {
      service.checkPublishTarget.mockRejectedValue(new ForbiddenException());

      await request(app.getHttpServer())
        .get('/api/v1/catalog/application/app__1.0.0/publish-target')
        .query({ folderPath: 'Org' })
        .expect(403);
    });
  });

  describe('POST /api/v1/catalog/:entityType/:entityId/publish', () => {
    const validBody = {
      folderPath: 'Organization/Data Science',
      version: '1.2.0',
    };

    it('delegates to the service and returns 201 with the publish result', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send(validBody)
        .expect(201);

      expect(res.body).toEqual(publishResult);
      expect(service.publish).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
        undefined,
        TEST_USER.sub,
      );
    });

    it('returns 400 for a request that still sends access rules', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, rules: [] })
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
    });

    it('forwards a submitted author to the service in place of the session name', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, author: 'DIAL Team' })
        .expect(201);

      expect(service.publish).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'DIAL Team',
        undefined,
        TEST_USER.sub,
      );
    });

    it('trims a submitted author before forwarding it', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, author: '  DIAL Team  ' })
        .expect(201);

      expect(service.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'DIAL Team',
        undefined,
        TEST_USER.sub,
      );
    });

    it('falls back to the session display name when author is blank', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, author: '   ' })
        .expect(201);

      expect(service.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
        undefined,
        TEST_USER.sub,
      );
    });

    it('forwards publishCredentials: true from the request body to the service', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, publishCredentials: true })
        .expect(201);

      expect(service.publish).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
        true,
        TEST_USER.sub,
      );
    });

    /* The controller never derives, infers, or overrides the flag. */
    it('forwards publishCredentials: false unchanged', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, publishCredentials: false })
        .expect(201);

      expect(service.publish).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
        false,
        TEST_USER.sub,
      );
    });

    it('returns 400 for a non-boolean publishCredentials without calling Core', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, publishCredentials: 'yes' })
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
    });

    it('returns 400 when author exceeds the 200-character limit', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, author: 'a'.repeat(201) })
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
    });

    it('returns 400 when author contains a control character', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, author: 'DIAL Team\nInjected log line' })
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
    });

    it('returns 400 for an unknown entityType', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/unknown-type/tool-abc123/publish')
        .send(validBody)
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
    });

    it('returns 400 when folderPath contains a path traversal attempt', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, folderPath: '../etc/passwd' })
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
    });

    it('accepts a skill publish request without version', async () => {
      const res = await request(app.getHttpServer())
        .post(
          '/api/v1/catalog/skill/skills%2Fbucket-123%2Fteam-a%2Fdocs-helper/publish',
        )
        .send({ folderPath: 'Organization/Data Science' })
        .expect(201);

      expect(res.body).toEqual(publishResult);
      expect(service.publish).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'skill',
        'skills/bucket-123/team-a/docs-helper',
        'Organization/Data Science',
        undefined,
        'Test User',
        undefined,
        TEST_USER.sub,
      );
    });

    it('returns 403 when the service throws ForbiddenException', async () => {
      service.publish.mockRejectedValue(new ForbiddenException());
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send(validBody)
        .expect(403);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.publish.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send(validBody)
        .expect(502);
    });

    describe('an application with dependencies', () => {
      const APPLICATION_URL =
        '/api/v1/catalog/application/applications%2Fbucket-123%2FHelper__1.0.0/publish';

      it('returns 409 with its own message when the application is already being published', async () => {
        service.publish.mockRejectedValue(
          new ConflictException('This application is already being published'),
        );

        const res = await request(app.getHttpServer())
          .post(APPLICATION_URL)
          .send(validBody)
          .expect(409);

        expect(res.body.message).toBe(
          'This application is already being published',
        );
      });

      it('returns 502 with the dependency message when the dependencies cannot be read', async () => {
        service.publish.mockRejectedValue(
          new BadGatewayException(
            "Failed to read the application's dependencies",
          ),
        );

        const res = await request(app.getHttpServer())
          .post(APPLICATION_URL)
          .send(validBody)
          .expect(502);

        expect(res.body.message).toBe(
          "Failed to read the application's dependencies",
        );
      });

      it('keeps the success response unchanged', async () => {
        const res = await request(app.getHttpServer())
          .post(APPLICATION_URL)
          .send(validBody)
          .expect(201);

        expect(res.body).toEqual(publishResult);
        expect(service.publish).toHaveBeenCalledWith(
          TEST_USER.at,
          TEST_USER.bucket,
          'application',
          'applications/bucket-123/Helper__1.0.0',
          'Organization/Data Science',
          '1.2.0',
          'Test User',
          undefined,
          TEST_USER.sub,
        );
      });
    });
  });

  describe('GET /api/v1/catalog/:entityType/:entityId/publish-history', () => {
    it('delegates to the service and returns 200 with the history list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/toolset/tool-abc123/publish-history')
        .expect(200);

      expect(res.body).toEqual([publishResult]);
      expect(service.getPublishHistory).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'toolset',
        'tool-abc123',
      );
    });

    it('returns 400 for an unknown entityType', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/catalog/unknown-type/tool-abc123/publish-history')
        .expect(400);

      expect(service.getPublishHistory).not.toHaveBeenCalled();
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.getPublishHistory.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .get('/api/v1/catalog/toolset/tool-abc123/publish-history')
        .expect(502);
    });
  });

  describe('GET /api/v1/catalog/:entityType/:entityId/version-statuses', () => {
    const entries = [
      {
        id: 'applications/bucket-123/Design/Review__1.0.0',
        version: '1.0.0',
        status: 'published',
        publishedFolders: ['Organization/Design'],
        publishedBy: 'Jane Doe',
      },
      {
        id: 'applications/bucket-123/Design/Review__1.1.0',
        version: '1.1.0',
        status: 'not-published',
        publishedFolders: [],
      },
    ];
    let statusesApp: INestApplication;
    let versionStatuses: { getVersionStatuses: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      versionStatuses = {
        getVersionStatuses: vi.fn().mockResolvedValue(entries),
      };
      statusesApp = await buildApp(service, versionStatuses);
    });

    afterEach(async () => {
      await statusesApp.close();
    });

    it('delegates to the service with the session and returns 200 with the entries', async () => {
      const res = await request(statusesApp.getHttpServer())
        .get(
          '/api/v1/catalog/application/applications%2Fbucket-123%2FDesign%2FReview__1.0.0/version-statuses',
        )
        .expect(200);

      expect(res.body).toEqual(entries);
      expect(versionStatuses.getVersionStatuses).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        TEST_USER.bucket,
        'application',
        'applications/bucket-123/Design/Review__1.0.0',
      );
    });

    it('returns 400 for an unknown entityType', async () => {
      await request(statusesApp.getHttpServer())
        .get('/api/v1/catalog/unknown-type/tool-abc123/version-statuses')
        .expect(400);

      expect(versionStatuses.getVersionStatuses).not.toHaveBeenCalled();
    });

    it('returns 400 for a path traversal entityId', async () => {
      await request(statusesApp.getHttpServer())
        .get(
          '/api/v1/catalog/application/..%2F..%2Fetc%2Fpasswd/version-statuses',
        )
        .expect(400);

      expect(versionStatuses.getVersionStatuses).not.toHaveBeenCalled();
    });

    it('returns 404 when the service finds no version', async () => {
      versionStatuses.getVersionStatuses.mockRejectedValue(
        new NotFoundException(),
      );

      await request(statusesApp.getHttpServer())
        .get(
          '/api/v1/catalog/application/applications%2Fb%2FX__1.0.0/version-statuses',
        )
        .expect(404);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      versionStatuses.getVersionStatuses.mockRejectedValue(
        new BadGatewayException(),
      );

      await request(statusesApp.getHttpServer())
        .get('/api/v1/catalog/toolset/toolsets%2Fb%2FX__1.0.0/version-statuses')
        .expect(502);
    });
  });
});

/*
 * The publish endpoint end to end with the real service, preparation and copy
 * code over a Core client faked at the SDK boundary, replaying the hand-built
 * fixtures of `dependencies/fixtures`.
 */
describe('PublishController with application dependencies (integration)', () => {
  const FIXTURES = join(__dirname, 'dependencies', 'fixtures');
  const readFixture = <T>(name: string): T =>
    JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as T;
  const requestFixture = readFixture<Record<string, unknown>>(
    'create-publication.request.json',
  );
  const responseFixture = readFixture<{
    status: string;
    targetFolder: string;
    resources: { sourceUrl: string; targetUrl: string; action: string }[];
  }>('create-publication.response.json');

  const SCHEMA = {
    $defs: {
      Skill: {
        properties: {
          type: { const: 'dial-skill', type: 'string' },
          url: { 'dial:resource': true, type: 'string' },
        },
      },
      App: {
        properties: {
          type: { const: 'dial-app', type: 'string' },
          deployment_id: { 'dial:resource': true, type: 'string' },
        },
      },
    },
    properties: {
      skills: { items: { oneOf: [{ $ref: '#/$defs/Skill' }] } },
      tool_sets: { items: { oneOf: [{ $ref: '#/$defs/App' }] } },
    },
  };

  let app: INestApplication;
  let stored: Map<string, unknown>;
  let client: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    stored = new Map([
      [
        'Helper__1.0.0',
        {
          application_type_schema_id: 'schema-1',
          application_properties: {
            skills: [
              { type: 'dial-skill', url: 'skills/bucket-123/Docs%20helper' },
            ],
            tool_sets: [
              {
                type: 'dial-app',
                deployment_id: 'applications/bucket-123/Calculator__1.0.0',
              },
            ],
          },
        },
      ],
    ]);
    const notFound = vi.fn().mockResolvedValue({ response: { status: 404 } });
    client = {
      createPublication: vi.fn().mockResolvedValue({
        data: responseFixture,
        response: { ok: true, status: 200 },
      }),
      getCustomApplication: vi
        .fn()
        .mockImplementation(async (_b: string, path: string) => ({
          data: stored.get(path),
          response: { status: 200, headers: new Headers({ etag: 'e1' }) },
        })),
      saveCustomApplication: vi
        .fn()
        .mockImplementation(async (_b: string, path: string, init) => {
          stored.set(path, init.body);
          return { response: { status: 200 } };
        }),
      copyResource: vi.fn().mockImplementation(async (init) => {
        const target = String(init.body.destinationUrl).replace(
          'applications/bucket-123/',
          '',
        );
        stored.set(target, structuredClone(stored.get('Helper__1.0.0')));
        return { response: { status: 200 } };
      }),
      deleteCustomApplication: vi
        .fn()
        .mockImplementation(async (_b: string, path: string) => {
          stored.delete(path);
          return { response: { status: 200 } };
        }),
      getApplicationMetadata: notFound,
      getPromptMetadata: notFound,
      listSkillMetadata: notFound,
      getToolSetMetadata: notFound,
    };
    const dialClient = { client } as never;
    const schemas = { getApplicationSchema: vi.fn().mockResolvedValue(SCHEMA) };
    const applications = {
      resolveOwnApplication: vi.fn().mockResolvedValue({
        bucket: 'bucket-123',
        path: 'Helper__1.0.0',
      }),
      readApplication: vi
        .fn()
        .mockImplementation(
          async (_h: unknown, resource: { path: string }) => ({
            body: structuredClone(stored.get(resource.path)),
            etag: 'e1',
          }),
        ),
      writeApplication: vi
        .fn()
        .mockImplementation(
          async (_h: unknown, resource: { path: string }, body: unknown) => {
            stored.set(resource.path, body);
          },
        ),
      invalidateAfterWrite: vi.fn().mockResolvedValue(undefined),
    };
    const preparation = new ApplicationPublishPreparationService(
      dialClient,
      new PublishDependenciesService(
        new ApplicationDependencyResolver(dialClient, schemas as never),
      ),
      new ApplicationPublishCopyService(dialClient, applications as never),
      applications as never,
      schemas as never,
    );
    const publishService = new PublishService(
      dialClient,
      { get: vi.fn(), set: vi.fn(), del: vi.fn() } as never,
      { isAdmin: vi.fn() } as never,
      preparation,
      {} as never,
    );
    app = await buildApp(publishService);
  });

  afterEach(async () => {
    await app.close();
  });

  const publishApplication = () =>
    request(app.getHttpServer())
      .post(
        '/api/v1/catalog/application/applications%2Fbucket-123%2FHelper__1.0.0/publish',
      )
      .send({ folderPath: 'Organization/Agents', version: '1.0.0' });

  it('sends one createPublication shaped like the fixture and deletes the copy', async () => {
    const res = await publishApplication().expect(201);

    expect(client.createPublication).toHaveBeenCalledTimes(1);
    expect(client.createPublication.mock.calls[0][0].body).toEqual(
      requestFixture,
    );
    expect(stored.has('.publish-staging/Helper__1.0.0')).toBe(false);
    expect(res.body.entityId).toBe('applications/bucket-123/Helper__1.0.0');
  });

  it('writes only the copy, rewritten to the published dependencies', async () => {
    let copyBody: unknown;
    client.createPublication.mockImplementation(async () => {
      copyBody = structuredClone(stored.get('.publish-staging/Helper__1.0.0'));
      return { data: responseFixture, response: { ok: true, status: 200 } };
    });

    await publishApplication().expect(201);

    expect(client.saveCustomApplication).not.toHaveBeenCalled();
    expect(copyBody).toEqual({
      application_type_schema_id: 'schema-1',
      application_properties: {
        skills: [
          {
            type: 'dial-skill',
            url: 'skills/public/Organization/Agents/.Helper__1.0.0.deps/bucket-123/Docs%20helper',
          },
        ],
        tool_sets: [
          {
            type: 'dial-app',
            deployment_id:
              'applications/public/Organization/Agents/.Helper__1.0.0.deps/bucket-123/Calculator__1.0.0',
          },
        ],
      },
    });
    expect(
      (stored.get('Helper__1.0.0') as { application_properties: unknown })
        .application_properties,
    ).toEqual({
      skills: [{ type: 'dial-skill', url: 'skills/bucket-123/Docs%20helper' }],
      tool_sets: [
        {
          type: 'dial-app',
          deployment_id: 'applications/bucket-123/Calculator__1.0.0',
        },
      ],
    });
  });

  it('lists the dependency application as a sibling ADD resource', async () => {
    await publishApplication().expect(201);

    const resources = client.createPublication.mock.calls[0][0].body
      .resources as { sourceUrl: string; targetUrl: string }[];
    const dependency = resources.find(
      ({ sourceUrl }) =>
        sourceUrl === 'applications/bucket-123/Calculator__1.0.0',
    );
    expect(dependency?.targetUrl).toBe(
      'applications/public/Organization/Agents/.Helper__1.0.0.deps/bucket-123/Calculator__1.0.0',
    );
  });

  it('reads the original as In review while the publication is pending', async () => {
    await publishApplication().expect(201);

    const status = resolveVersionStatus(
      [responseFixture as never],
      'applications/bucket-123/Helper__1.0.0',
    );
    expect(status.status).toBe(VersionPublicationStatus.InReview);
  });

  it('publishes the application the way it was before when its dependencies cannot be read', async () => {
    client.getCustomApplication.mockResolvedValue({
      error: {},
      response: { status: 500 },
    });

    await publishApplication().expect(201);

    expect(client.copyResource).not.toHaveBeenCalled();
    expect(client.createPublication).toHaveBeenCalledOnce();
  });
});
