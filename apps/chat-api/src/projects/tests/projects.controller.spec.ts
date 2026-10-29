import {
  BadGatewayException,
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureKey } from '../../app-config/feature-flags/feature-key.enum';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { FEATURE_KEY_METADATA } from '../../app-config/feature-flags/require-feature.decorator';
import { AuthSource } from '../../auth/auth-source.enum';
import { SessionGuard } from '../../auth/session/session.guard';
import type { SessionUser } from '../../auth/session/session.types';
import { ProjectsDownloadService } from '../download/projects-download.service';
import { ProjectSource } from '../dto/project-source.enum';
import { ProjectContextUploadInterceptor } from '../project-context-upload.interceptor';
import { ProjectsController } from '../projects.controller';
import { ProjectsService } from '../projects.service';
import { ProjectCreateErrorCode } from '../types/project-create-error-code.enum';
import { ProjectsUpdateService } from '../update/projects-update.service';
import { projectConflict } from '../utils/project-create-error.util';

const TEST_USER = {
  sub: 'user-1',
  at: 'test-access-token',
  bucket: 'test-bucket',
} as SessionUser;

const listing = {
  items: [
    {
      id: 'projects/test-bucket/alpha',
      name: 'alpha',
      bucket: 'test-bucket',
      path: 'alpha',
      source: ProjectSource.Personal,
      updatedAt: 1791234567000,
    },
  ],
  incompleteSources: [ProjectSource.Organization],
};

const testConfig = {
  get: (key: string) =>
    key === 'PROJECT_CONTEXT_FILE_MAX_BYTES' ? 16 : undefined,
};

type ServiceMock = {
  listProjects: ReturnType<typeof vi.fn>;
  createProject: ReturnType<typeof vi.fn>;
  getProject: ReturnType<typeof vi.fn>;
  deleteProject: ReturnType<typeof vi.fn>;
};

type DownloadMock = {
  downloadProject: ReturnType<typeof vi.fn>;
  downloadContextFile: ReturnType<typeof vi.fn>;
};

const updateService = { updateProject: vi.fn() };

const downloadService: DownloadMock = {
  downloadProject: vi.fn(),
  downloadContextFile: vi.fn(),
};

const buildApp = async (
  service: ServiceMock,
  isFeatureEnabled = true,
  { authenticated = true }: { authenticated?: boolean } = {},
): Promise<INestApplication> => {
  const module = await Test.createTestingModule({
    controllers: [ProjectsController],
    providers: [
      { provide: ProjectsService, useValue: service },
      { provide: ProjectsDownloadService, useValue: downloadService },
      { provide: ProjectsUpdateService, useValue: updateService },
      ProjectContextUploadInterceptor,
      { provide: ConfigService, useValue: testConfig },
    ],
  })
    .overrideGuard(FeatureGuard)
    .useValue({ canActivate: () => isFeatureEnabled })
    .compile();

  const app = module.createNestApplication();
  if (authenticated) {
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
  } else {
    app.useGlobalGuards(
      new SessionGuard(
        [
          {
            source: AuthSource.Cookie,
            supports: () => false,
            authenticate: async () => TEST_USER,
          },
        ],
        new Reflector(),
      ),
    );
  }
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
  return app;
};

describe('ProjectsController (integration)', () => {
  let app: INestApplication;
  let service: ServiceMock;

  beforeEach(() => {
    service = {
      listProjects: vi.fn().mockResolvedValue(listing),
      createProject: vi.fn(),
      getProject: vi.fn(),
      deleteProject: vi.fn(),
    };
  });

  afterEach(async () => {
    await app?.close();
  });

  it('returns the project list with a no-store cache header', async () => {
    app = await buildApp(service);

    const res = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .expect(200);

    expect(res.body).toEqual(listing);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(service.listProjects).toHaveBeenCalledWith(
      TEST_USER.bucket,
      TEST_USER.at,
    );
  });

  it('gates the whole controller behind FeatureGuard and projectsEnabled', () => {
    /* The HTTP tests override FeatureGuard, so this reflection check is what
     * fails if the class-level guard or its feature key is dropped. */
    expect(Reflect.getMetadata(GUARDS_METADATA, ProjectsController)).toEqual([
      FeatureGuard,
    ]);
    expect(Reflect.getMetadata(FEATURE_KEY_METADATA, ProjectsController)).toBe(
      FeatureKey.ProjectsEnabled,
    );
  });

  it('rejects the request with 403 when the feature is disabled', async () => {
    app = await buildApp(service, false);

    await request(app.getHttpServer()).get('/api/v1/projects').expect(403);

    expect(service.listProjects).not.toHaveBeenCalled();
  });

  it('lists the session bucket and ignores a client-supplied bucket or path', async () => {
    app = await buildApp(service);

    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .query({ bucket: 'other-user', path: '../../etc' })
      .expect(200);

    expect(service.listProjects).toHaveBeenCalledOnce();
    expect(service.listProjects).toHaveBeenCalledWith(
      TEST_USER.bucket,
      TEST_USER.at,
    );
  });

  it.each([
    [new BadGatewayException('upstream'), 502],
    [new ServiceUnavailableException('down'), 503],
  ])('surfaces a service %s as its HTTP status', async (error, status) => {
    service.listProjects.mockRejectedValue(error);
    app = await buildApp(service);

    await request(app.getHttpServer()).get('/api/v1/projects').expect(status);
  });

  describe('POST /api/v1/projects', () => {
    const created = {
      id: 'projects/test-bucket/Handbook',
      name: 'Handbook',
      bucket: 'test-bucket',
      path: 'Handbook',
      etag: '"e1"',
    };

    beforeEach(() => {
      service.createProject = vi.fn().mockResolvedValue(created);
    });

    it('creates a project from multipart fields and files with 201', async () => {
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .field('name', 'Handbook')
        .field('description', 'About it')
        .field('instructions', '## Steps')
        .field('fileNames', '["tickets.csv"]')
        .attach('files', Buffer.from('a,b'), 'tickets.csv')
        .expect(201);

      expect(res.body).toEqual(created);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(service.createProject).toHaveBeenCalledOnce();
      const [bucket, body, files, token, signal] =
        service.createProject.mock.calls[0];
      expect(bucket).toBe(TEST_USER.bucket);
      expect(body).toMatchObject({
        name: 'Handbook',
        description: 'About it',
        instructions: '## Steps',
        fileNames: '["tickets.csv"]',
      });
      expect(
        files.map((file: { buffer: Buffer }) => file.buffer.toString()),
      ).toEqual(['a,b']);
      expect(token).toBe(TEST_USER.at);
      expect(signal).toBeInstanceOf(AbortSignal);
    });

    it('creates a name-only project with no files', async () => {
      app = await buildApp(service);

      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .field('name', 'Handbook')
        .expect(201);

      expect(service.createProject.mock.calls[0][2]).toEqual([]);
    });

    it('rejects a client-supplied bucket instead of writing elsewhere', async () => {
      app = await buildApp(service);

      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .field('name', 'Handbook')
        .field('bucket', 'other-user')
        .expect(400);

      expect(service.createProject).not.toHaveBeenCalled();
    });

    it('rejects the request with 403 when the feature is disabled', async () => {
      app = await buildApp(service, false);

      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .field('name', 'Handbook')
        .expect(403);

      expect(service.createProject).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated request with 401', async () => {
      app = await buildApp(service, true, { authenticated: false });

      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .field('name', 'Handbook')
        .expect(401);

      expect(service.createProject).not.toHaveBeenCalled();
    });

    it('rejects a missing name with 400', async () => {
      app = await buildApp(service);

      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .field('description', 'no name')
        .expect(400);

      expect(service.createProject).not.toHaveBeenCalled();
    });

    it('rejects an oversized part with a typed 413 before the service runs', async () => {
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .field('name', 'Handbook')
        .field('fileNames', '["big.csv"]')
        .attach('files', Buffer.alloc(17, 'a'), 'big.csv')
        .expect(413);

      expect(res.body).toMatchObject({ code: 'file-too-large' });
      expect(service.createProject).not.toHaveBeenCalled();
    });

    it('returns the typed 409 body for a duplicate name', async () => {
      service.createProject = vi
        .fn()
        .mockRejectedValue(
          projectConflict(
            ProjectCreateErrorCode.NameTaken,
            'A project with this name already exists',
            'name',
          ),
        );
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .field('name', 'Handbook')
        .expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        error: 'Conflict',
        code: 'name-taken',
        field: 'name',
        message: 'A project with this name already exists',
      });
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    const PROJECT_ID = 'projects/test-bucket/marketing/q4';
    const details = {
      id: PROJECT_ID,
      name: 'q4',
      bucket: 'test-bucket',
      path: 'marketing/q4',
      parentPath: 'marketing',
      source: ProjectSource.Personal,
      description: 'About Q4',
      instructions: '## Steps',
      contextFiles: [{ name: 'tickets.csv', size: 2048 }],
      etag: '"e1"',
      canEdit: true,
    };

    it('returns the project for its encoded id with a no-store cache header', async () => {
      service.getProject.mockResolvedValue(details);
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}`)
        .expect(200);

      expect(res.body).toEqual(details);
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(service.getProject).toHaveBeenCalledWith(
        PROJECT_ID,
        TEST_USER.bucket,
        TEST_USER.at,
        expect.any(AbortSignal),
      );
    });

    it('rejects a traversal id with 400 before calling the service', async () => {
      app = await buildApp(service);

      await request(app.getHttpServer())
        .get(
          `/api/v1/projects/${encodeURIComponent('projects/test-bucket/../other')}`,
        )
        .expect(400);

      expect(service.getProject).not.toHaveBeenCalled();
    });

    it('rejects an id with a foreign prefix with 400', async () => {
      app = await buildApp(service);

      await request(app.getHttpServer())
        .get(`/api/v1/projects/${encodeURIComponent('skills/test-bucket/q4')}`)
        .expect(400);

      expect(service.getProject).not.toHaveBeenCalled();
    });

    it('rejects the request with 403 when the feature is disabled', async () => {
      app = await buildApp(service, false);

      await request(app.getHttpServer())
        .get(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}`)
        .expect(403);

      expect(service.getProject).not.toHaveBeenCalled();
    });
  });

  describe('project downloads', () => {
    const PROJECT_ID = 'projects/test-bucket/q4';
    const streamOf = (text: string) =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('streams the archive with the attachment and nosniff headers', async () => {
      downloadService.downloadProject.mockResolvedValue({
        stream: streamOf('zip-bytes'),
        headers: {
          'content-type': 'application/zip',
          'content-disposition': "attachment; filename*=UTF-8''q4.zip",
          'x-content-type-options': 'nosniff',
        },
        abortOnDisconnect: vi.fn(),
      });
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}/archive`)
        .buffer(true)
        .parse((response, done) => {
          let body = '';
          response.on('data', (chunk: Buffer) => (body += chunk.toString()));
          response.on('end', () => done(null, body));
        })
        .expect(200);

      expect(res.body).toBe('zip-bytes');
      expect(res.headers['content-disposition']).toBe(
        "attachment; filename*=UTF-8''q4.zip",
      );
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(downloadService.downloadProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: PROJECT_ID, bucket: 'test-bucket' }),
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('streams one context file by name', async () => {
      downloadService.downloadContextFile.mockResolvedValue({
        stream: streamOf('a,b'),
        headers: { 'content-type': 'text/csv' },
        abortOnDisconnect: vi.fn(),
      });
      app = await buildApp(service);

      await request(app.getHttpServer())
        .get(
          `/api/v1/projects/${encodeURIComponent(PROJECT_ID)}/files/tickets.csv`,
        )
        .expect(200);

      expect(downloadService.downloadContextFile).toHaveBeenCalledWith(
        expect.objectContaining({ id: PROJECT_ID }),
        'tickets.csv',
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('rejects a traversal file name with 400', async () => {
      app = await buildApp(service);

      await request(app.getHttpServer())
        .get(
          `/api/v1/projects/${encodeURIComponent(PROJECT_ID)}/files/${encodeURIComponent('../secret')}`,
        )
        .expect(400);

      expect(downloadService.downloadContextFile).not.toHaveBeenCalled();
    });

    it('answers 404 when the file does not exist', async () => {
      downloadService.downloadContextFile.mockRejectedValue(
        new NotFoundException('Project or file not found'),
      );
      app = await buildApp(service);

      await request(app.getHttpServer())
        .get(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}/files/x.csv`)
        .expect(404);
    });

    it('rejects a download with 403 when the feature is disabled', async () => {
      app = await buildApp(service, false);

      await request(app.getHttpServer())
        .get(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}/archive`)
        .expect(403);

      expect(downloadService.downloadProject).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    const PROJECT_ID = 'projects/test-bucket/q4';

    it('passes If-Match to the service and answers 204', async () => {
      service.deleteProject.mockResolvedValue(undefined);
      app = await buildApp(service);

      await request(app.getHttpServer())
        .delete(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}`)
        .set('If-Match', '"e1"')
        .expect(204);

      expect(service.deleteProject).toHaveBeenCalledWith(
        PROJECT_ID,
        '"e1"',
        TEST_USER.bucket,
        TEST_USER.at,
      );
    });

    it('answers 409 with project-changed for a stale ETag', async () => {
      service.deleteProject.mockRejectedValue(
        projectConflict(ProjectCreateErrorCode.ProjectChanged, 'changed'),
      );
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}`)
        .set('If-Match', '"old"')
        .expect(409);

      expect(res.body.code).toBe('project-changed');
    });

    it('rejects a traversal id with 400', async () => {
      app = await buildApp(service);

      await request(app.getHttpServer())
        .delete(
          `/api/v1/projects/${encodeURIComponent('projects/test-bucket/..')}`,
        )
        .set('If-Match', '"e1"')
        .expect(400);

      expect(service.deleteProject).not.toHaveBeenCalled();
    });

    it('rejects a delete with 403 when the feature is disabled', async () => {
      app = await buildApp(service, false);

      await request(app.getHttpServer())
        .delete(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}`)
        .set('If-Match', '"e1"')
        .expect(403);

      expect(service.deleteProject).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/v1/projects/:id', () => {
    const PROJECT_ID = 'projects/test-bucket/q4';
    const saved = {
      id: 'projects/test-bucket/Q4 launch',
      name: 'Q4 launch',
      bucket: 'test-bucket',
      path: 'Q4 launch',
      etag: '"e2"',
      isPinned: true,
    };

    beforeEach(() => {
      updateService.updateProject.mockReset();
    });

    it('passes the fields, new files and If-Match to the update service', async () => {
      updateService.updateProject.mockResolvedValue(saved);
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .put(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}`)
        .set('If-Match', '"e1"')
        .field('name', 'Q4 launch')
        .field('description', 'About')
        .field('fileNames', '["a.csv"]')
        .field('removedFileNames', '["b.csv"]')
        .attach('files', Buffer.from('x,y'), 'a.csv')
        .expect(200);

      expect(res.body).toEqual(saved);
      const [project, body, files, ifMatch, bucket, at] =
        updateService.updateProject.mock.calls[0];
      expect(project).toMatchObject({ id: PROJECT_ID, bucket: 'test-bucket' });
      expect(body).toMatchObject({
        name: 'Q4 launch',
        description: 'About',
        fileNames: '["a.csv"]',
        removedFileNames: '["b.csv"]',
      });
      expect(files).toHaveLength(1);
      expect(ifMatch).toBe('"e1"');
      expect(bucket).toBe(TEST_USER.bucket);
      expect(at).toBe(TEST_USER.at);
    });

    it('answers 409 with name-taken for a rename onto an existing name', async () => {
      updateService.updateProject.mockRejectedValue(
        projectConflict(ProjectCreateErrorCode.NameTaken, 'taken', 'name'),
      );
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .put(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}`)
        .set('If-Match', '"e1"')
        .field('name', 'Handbook')
        .expect(409);

      expect(res.body).toMatchObject({ code: 'name-taken', field: 'name' });
    });

    it('answers 409 with project-changed for a stale ETag', async () => {
      updateService.updateProject.mockRejectedValue(
        projectConflict(ProjectCreateErrorCode.ProjectChanged, 'changed'),
      );
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .put(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}`)
        .set('If-Match', '"old"')
        .field('name', 'q4')
        .expect(409);

      expect(res.body.code).toBe('project-changed');
    });

    it('rejects an unknown multipart field', async () => {
      app = await buildApp(service);

      await request(app.getHttpServer())
        .put(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}`)
        .set('If-Match', '"e1"')
        .field('name', 'q4')
        .field('bucket', 'other-user')
        .expect(400);

      expect(updateService.updateProject).not.toHaveBeenCalled();
    });

    it('rejects a traversal id with 400', async () => {
      app = await buildApp(service);

      await request(app.getHttpServer())
        .put(
          `/api/v1/projects/${encodeURIComponent('projects/test-bucket/../x')}`,
        )
        .set('If-Match', '"e1"')
        .field('name', 'q4')
        .expect(400);

      expect(updateService.updateProject).not.toHaveBeenCalled();
    });

    it('rejects a save with 403 when the feature is disabled', async () => {
      app = await buildApp(service, false);

      await request(app.getHttpServer())
        .put(`/api/v1/projects/${encodeURIComponent(PROJECT_ID)}`)
        .set('If-Match', '"e1"')
        .field('name', 'q4')
        .expect(403);

      expect(updateService.updateProject).not.toHaveBeenCalled();
    });
  });
});
