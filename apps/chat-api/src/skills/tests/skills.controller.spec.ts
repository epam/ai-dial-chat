import { EventEmitter } from 'node:events';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  INestApplication,
  NotFoundException,
  PayloadTooLargeException,
  PreconditionFailedException,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SkillListResponseDto } from '../dto/skill-metadata.dto';
import { SkillsController } from '../skills.controller';
import { SkillsService } from '../skills.service';

const TEST_USER = {
  sub: 'user-123',
  at: 'test-access-token',
  bucket: 'test-bucket',
};

const mockListResponse: SkillListResponseDto = {
  bucket: 'my-bucket',
  path: '',
  items: [],
};

async function buildApp(service: unknown): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [SkillsController],
    providers: [{ provide: SkillsService, useValue: service }],
  }).compile();

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
  return app;
}

describe('SkillsController (integration)', () => {
  let app: INestApplication;
  let service: {
    listSkills: ReturnType<typeof vi.fn>;
    listCatalogSkills: ReturnType<typeof vi.fn>;
    listSkillFiles: ReturnType<typeof vi.fn>;
    downloadSkill: ReturnType<typeof vi.fn>;
    downloadSkillFile: ReturnType<typeof vi.fn>;
    createSkill: ReturnType<typeof vi.fn>;
    updateSkill: ReturnType<typeof vi.fn>;
    uploadSkillFile: ReturnType<typeof vi.fn>;
    deleteSkill: ReturnType<typeof vi.fn>;
    deleteSkillFile: ReturnType<typeof vi.fn>;
    createSkillGroupingFolder: ReturnType<typeof vi.fn>;
    deleteSkillGroupingFolder: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listSkills: vi.fn().mockResolvedValue(mockListResponse),
      listCatalogSkills: vi.fn().mockResolvedValue({
        skills: [],
        sharedWithMe: [],
        publicSkills: [],
      }),
      listSkillFiles: vi.fn().mockResolvedValue(mockListResponse),
      downloadSkill: vi.fn(),
      downloadSkillFile: vi.fn(),
      createSkill: vi.fn(),
      updateSkill: vi.fn(),
      uploadSkillFile: vi.fn(),
      deleteSkill: vi.fn(),
      deleteSkillFile: vi.fn(),
      createSkillGroupingFolder: vi.fn(),
      deleteSkillGroupingFolder: vi.fn(),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/skills', () => {
    it('returns 200 and delegates to the service with defaults', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/skills?bucket=my-bucket')
        .expect(200);

      expect(res.body).toEqual(mockListResponse);
      expect(service.listSkills).toHaveBeenCalledWith(
        'my-bucket',
        '',
        { token: undefined, limit: undefined, recursive: undefined },
        TEST_USER.at,
      );
    });

    it('forwards path, token, limit, and recursive', async () => {
      await request(app.getHttpServer())
        .get(
          '/api/v1/skills?bucket=my-bucket&path=team-a/&token=abc&limit=50&recursive=true',
        )
        .expect(200);

      expect(service.listSkills).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/',
        { token: 'abc', limit: 50, recursive: true },
        TEST_USER.at,
      );
    });

    it('returns 400 when bucket is missing', async () => {
      await request(app.getHttpServer()).get('/api/v1/skills').expect(400);
      expect(service.listSkills).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid bucket name', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/skills?bucket=invalid/bucket')
        .expect(400);
      expect(service.listSkills).not.toHaveBeenCalled();
    });

    it('returns 400 for a negative limit', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/skills?bucket=my-bucket&limit=-1')
        .expect(400);
      expect(service.listSkills).not.toHaveBeenCalled();
    });

    it('returns 400 for a limit exceeding 1000', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/skills?bucket=my-bucket&limit=1001')
        .expect(400);
      expect(service.listSkills).not.toHaveBeenCalled();
    });

    it('returns 401 when the service throws UnauthorizedException', async () => {
      service.listSkills.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .get('/api/v1/skills?bucket=my-bucket')
        .expect(401);
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.listSkills.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .get('/api/v1/skills?bucket=my-bucket')
        .expect(404);
    });

    it('returns 429 when the service throws a 429 HttpException', async () => {
      service.listSkills.mockRejectedValue(
        new HttpException('Too many requests', 429),
      );
      await request(app.getHttpServer())
        .get('/api/v1/skills?bucket=my-bucket')
        .expect(429);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.listSkills.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .get('/api/v1/skills?bucket=my-bucket')
        .expect(502);
    });

    it('returns 503 when the service throws ServiceUnavailableException', async () => {
      service.listSkills.mockRejectedValue(new ServiceUnavailableException());
      await request(app.getHttpServer())
        .get('/api/v1/skills?bucket=my-bucket')
        .expect(503);
    });
  });

  describe('GET /api/v1/skills/catalog', () => {
    it('lists every catalog namespace for the session user', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/skills/catalog')
        .expect(200);

      expect(service.listCatalogSkills).toHaveBeenCalledWith(
        TEST_USER.bucket,
        TEST_USER.at,
      );
    });
  });

  describe('GET /api/v1/skills/files', () => {
    it('returns 200 and delegates to the service', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/v1/skills/files?bucket=my-bucket&path=team-a/docs-helper&filePath=',
        )
        .expect(200);

      expect(res.body).toEqual(mockListResponse);
      expect(service.listSkillFiles).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        '',
        { token: undefined, limit: undefined, recursive: undefined },
        TEST_USER.at,
      );
    });

    it('returns 400 when filePath is missing', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/skills/files?bucket=my-bucket&path=team-a/docs-helper')
        .expect(400);
      expect(service.listSkillFiles).not.toHaveBeenCalled();
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.listSkillFiles.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .get(
          '/api/v1/skills/files?bucket=my-bucket&path=team-a/docs-helper&filePath=',
        )
        .expect(404);
    });
  });

  describe('GET /api/v1/skills/download', () => {
    const makeZipStream = () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });

    it('streams a 200 response with forwarded headers', async () => {
      service.downloadSkill.mockResolvedValue({
        stream: makeZipStream(),
        headers: {
          'content-type': 'application/zip',
          etag: '"abc123"',
        },
        abortOnDisconnect: vi.fn(),
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/skills/download?bucket=my-bucket&path=team-a/docs-helper')
        .expect(200);

      expect(res.headers['content-type']).toMatch('application/zip');
      expect(res.headers.etag).toBe('"abc123"');
      expect(service.downloadSkill).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        TEST_USER.at,
      );
    });

    it('returns 400 when the service rejects a grouping-folder path', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      service.downloadSkill.mockRejectedValue(
        new BadRequestException('grouping folder'),
      );
      await request(app.getHttpServer())
        .get('/api/v1/skills/download?bucket=my-bucket&path=team-a/')
        .expect(400);
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.downloadSkill.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .get('/api/v1/skills/download?bucket=my-bucket&path=team-a/docs-helper')
        .expect(404);
    });
  });

  describe('GET /api/v1/skills/files/download', () => {
    const makeFileStream = () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([9, 9]));
          controller.close();
        },
      });

    it('streams a 200 response with the dynamic content-type header', async () => {
      service.downloadSkillFile.mockResolvedValue({
        stream: makeFileStream(),
        headers: { 'content-type': 'text/markdown' },
        abortOnDisconnect: vi.fn(),
      });

      const res = await request(app.getHttpServer())
        .get(
          '/api/v1/skills/files/download?bucket=my-bucket&path=team-a/docs-helper&filePath=SKILL.md',
        )
        .expect(200);

      expect(res.headers['content-type']).toMatch('text/markdown');
      expect(service.downloadSkillFile).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        'SKILL.md',
        TEST_USER.at,
      );
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.downloadSkillFile.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .get(
          '/api/v1/skills/files/download?bucket=my-bucket&path=team-a/docs-helper&filePath=SKILL.md',
        )
        .expect(404);
    });
  });

  describe('POST /api/v1/skills', () => {
    it('returns 201 and delegates to the service with skillManifest/filePaths/files, no If-Match', async () => {
      service.createSkill.mockResolvedValue({ etag: '"abc123"' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/skills')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('skillManifest', '---\nname: x\ndescription: y\n---\n\nbody')
        .field('filePaths', JSON.stringify(['scripts/run.sh']))
        .attach('files', Buffer.from('echo hi'), 'run.sh')
        .expect(201);

      expect(res.body).toEqual({ etag: '"abc123"' });
      expect(service.createSkill).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        '---\nname: x\ndescription: y\n---\n\nbody',
        JSON.stringify(['scripts/run.sh']),
        [expect.objectContaining({ mimetype: expect.any(String) })],
        TEST_USER.at,
        expect.any(AbortSignal),
      );
    });

    /*
     * The controller here mocks SkillsService entirely, so this exercises
     * routing/status-code propagation only — the real path-safety/limit
     * rejection logic is covered against the live SkillsPackageService in
     * skills-package.service.spec.ts.
     */
    it('returns 400 when the service rejects an unsafe supporting path', async () => {
      service.createSkill.mockRejectedValue(
        new BadRequestException('Invalid supporting file path'),
      );

      await request(app.getHttpServer())
        .post('/api/v1/skills')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('skillManifest', 'manifest')
        .field('filePaths', JSON.stringify(['../escape.md']))
        .attach('files', Buffer.from('x'), 'escape.md')
        .expect(400);
    });

    it('returns 400 when bucket is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/skills')
        .field('path', 'team-a/docs-helper')
        .field('skillManifest', 'manifest')
        .field('filePaths', '[]')
        .expect(400);
      expect(service.createSkill).not.toHaveBeenCalled();
    });

    it('returns 400 when skillManifest is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/skills')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('filePaths', '[]')
        .expect(400);
      expect(service.createSkill).not.toHaveBeenCalled();
    });

    it('returns 409 when the service throws ConflictException', async () => {
      service.createSkill.mockRejectedValue(new ConflictException());
      await request(app.getHttpServer())
        .post('/api/v1/skills')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('skillManifest', 'manifest')
        .field('filePaths', '[]')
        .expect(409);
    });

    it('returns 413 when the service throws PayloadTooLargeException', async () => {
      service.createSkill.mockRejectedValue(new PayloadTooLargeException());
      await request(app.getHttpServer())
        .post('/api/v1/skills')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('skillManifest', 'manifest')
        .field('filePaths', '[]')
        .expect(413);
    });

    it('returns 429 when the service throws a 429 HttpException', async () => {
      service.createSkill.mockRejectedValue(
        new HttpException('Too many requests', 429),
      );
      await request(app.getHttpServer())
        .post('/api/v1/skills')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('skillManifest', 'manifest')
        .field('filePaths', '[]')
        .expect(429);
    });
  });

  describe('PUT /api/v1/skills', () => {
    it('returns 200 and delegates to the service with skillManifest/filePaths/files and If-Match', async () => {
      service.updateSkill.mockResolvedValue({ etag: '"abc123"' });

      const res = await request(app.getHttpServer())
        .put('/api/v1/skills')
        .set('If-Match', '"prev-etag"')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('skillManifest', '---\nname: x\ndescription: y\n---\n\nbody')
        .field('filePaths', '[]')
        .expect(200);

      expect(res.body).toEqual({ etag: '"abc123"' });
      expect(service.updateSkill).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        '---\nname: x\ndescription: y\n---\n\nbody',
        '[]',
        [],
        '"prev-etag"',
        TEST_USER.at,
        expect.any(AbortSignal),
      );
    });

    it('returns 428 when If-Match is missing, without calling the service', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/skills')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('skillManifest', 'manifest')
        .field('filePaths', '[]')
        .expect(428);
      expect(service.updateSkill).not.toHaveBeenCalled();
    });

    it('returns 400 when bucket is missing', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/skills')
        .set('If-Match', '"prev-etag"')
        .field('path', 'team-a/docs-helper')
        .field('skillManifest', 'manifest')
        .field('filePaths', '[]')
        .expect(400);
      expect(service.updateSkill).not.toHaveBeenCalled();
    });

    it('returns 412 when the service throws PreconditionFailedException', async () => {
      service.updateSkill.mockRejectedValue(new PreconditionFailedException());
      await request(app.getHttpServer())
        .put('/api/v1/skills')
        .set('If-Match', '"stale-etag"')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('skillManifest', 'manifest')
        .field('filePaths', '[]')
        .expect(412);
    });

    it('returns 413 when the service throws PayloadTooLargeException', async () => {
      service.updateSkill.mockRejectedValue(new PayloadTooLargeException());
      await request(app.getHttpServer())
        .put('/api/v1/skills')
        .set('If-Match', '"prev-etag"')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('skillManifest', 'manifest')
        .field('filePaths', '[]')
        .expect(413);
    });

    it('returns 429 when the service throws a 429 HttpException', async () => {
      service.updateSkill.mockRejectedValue(
        new HttpException('Too many requests', 429),
      );
      await request(app.getHttpServer())
        .put('/api/v1/skills')
        .set('If-Match', '"prev-etag"')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('skillManifest', 'manifest')
        .field('filePaths', '[]')
        .expect(429);
    });
  });

  describe('PUT /api/v1/skills/files', () => {
    it('returns 200 and delegates to the service with the uploaded file', async () => {
      service.uploadSkillFile.mockResolvedValue({ etag: '"def456"' });

      const res = await request(app.getHttpServer())
        .put('/api/v1/skills/files')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('filePath', 'scripts/helper.py')
        .attach('file', Buffer.from('print(1)'), 'helper.py')
        .expect(200);

      expect(res.body).toEqual({ etag: '"def456"' });
      expect(service.uploadSkillFile).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        'scripts/helper.py',
        expect.objectContaining({ mimetype: expect.any(String) }),
        TEST_USER.at,
        undefined,
        expect.any(AbortSignal),
      );
    });

    it('returns 400 when filePath is missing', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/skills/files')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .attach('file', Buffer.from('print(1)'), 'helper.py')
        .expect(400);
      expect(service.uploadSkillFile).not.toHaveBeenCalled();
    });

    it('returns 400 when no file is attached, without calling the service', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/skills/files')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('filePath', 'scripts/helper.py')
        .expect(400);
      expect(service.uploadSkillFile).not.toHaveBeenCalled();
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.uploadSkillFile.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .put('/api/v1/skills/files')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .field('filePath', 'scripts/helper.py')
        .attach('file', Buffer.from('print(1)'), 'helper.py')
        .expect(404);
    });
  });

  describe('DELETE /api/v1/skills', () => {
    it('returns 200 and delegates to the service with If-Match', async () => {
      service.deleteSkill.mockResolvedValue({ success: true });

      const res = await request(app.getHttpServer())
        .delete('/api/v1/skills?bucket=my-bucket&path=team-a/docs-helper')
        .set('If-Match', '"etag"')
        .expect(200);

      expect(res.body).toEqual({ success: true });
      expect(service.deleteSkill).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        TEST_USER.at,
        '"etag"',
      );
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.deleteSkill.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .delete('/api/v1/skills?bucket=my-bucket&path=team-a/docs-helper')
        .expect(404);
    });
  });

  describe('DELETE /api/v1/skills/files', () => {
    it('returns 200 and delegates to the service, rejecting SKILL.md deletion via the service', async () => {
      service.deleteSkillFile.mockRejectedValue(
        new BadRequestException('Cannot delete SKILL.md'),
      );

      await request(app.getHttpServer())
        .delete(
          '/api/v1/skills/files?bucket=my-bucket&path=team-a/docs-helper&filePath=SKILL.md',
        )
        .expect(400);
    });

    it('returns 200 with the new ETag on success', async () => {
      service.deleteSkillFile.mockResolvedValue({ etag: '"new-etag"' });

      const res = await request(app.getHttpServer())
        .delete(
          '/api/v1/skills/files?bucket=my-bucket&path=team-a/docs-helper&filePath=scripts/helper.py',
        )
        .expect(200);

      expect(res.body).toEqual({ etag: '"new-etag"' });
    });
  });

  describe('POST /api/v1/skills/grouping-folders', () => {
    it('returns 200 and delegates to the service', async () => {
      service.createSkillGroupingFolder.mockResolvedValue({
        etag: '"folder-etag"',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/skills/grouping-folders?bucket=my-bucket&path=team-a/')
        .expect(200);

      expect(res.body).toEqual({ etag: '"folder-etag"' });
      expect(service.createSkillGroupingFolder).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/',
        TEST_USER.at,
      );
    });

    it('returns 400 when the service rejects a create collision', async () => {
      service.createSkillGroupingFolder.mockRejectedValue(
        new BadRequestException('already exists'),
      );
      await request(app.getHttpServer())
        .post('/api/v1/skills/grouping-folders?bucket=my-bucket&path=team-a/')
        .expect(400);
    });
  });

  describe('DELETE /api/v1/skills/grouping-folders', () => {
    it('returns 200 and delegates to the service', async () => {
      service.deleteSkillGroupingFolder.mockResolvedValue({ success: true });

      const res = await request(app.getHttpServer())
        .delete('/api/v1/skills/grouping-folders?bucket=my-bucket&path=team-a/')
        .expect(200);

      expect(res.body).toEqual({ success: true });
    });

    it('returns 409 when the service throws ConflictException for a non-empty folder', async () => {
      const { ConflictException } = await import('@nestjs/common');
      service.deleteSkillGroupingFolder.mockRejectedValue(
        new ConflictException('not empty'),
      );
      await request(app.getHttpServer())
        .delete('/api/v1/skills/grouping-folders?bucket=my-bucket&path=team-a/')
        .expect(409);
    });
  });

  /*
   * Instantiates the controller directly (bypassing supertest/the full Nest
   * app) so these tests can control the exact timing of a client disconnect
   * relative to the async service call — something an HTTP-level test
   * cannot reliably simulate.
   */
  describe('SkillsController — cancellation timing', () => {
    it('downloadSkill calls abortOnDisconnect immediately when the client disconnects while the service call is still pending', async () => {
      const controller = new SkillsController(service as never);
      const abortOnDisconnect = vi.fn();
      let resolveDownload!: (value: unknown) => void;
      const downloadPromise = new Promise((resolve) => {
        resolveDownload = resolve;
      });
      service.downloadSkill.mockReturnValue(downloadPromise);

      const req = new EventEmitter() as unknown as Request & {
        user: typeof TEST_USER;
      };
      req.user = TEST_USER;
      const res = new EventEmitter() as unknown as Response;

      const callPromise = controller.downloadSkill(
        { bucket: 'my-bucket', path: 'team-a/docs-helper' },
        req,
        res,
      );

      // Client disconnects before skillsService.downloadSkill() resolves.
      res.emit('close');
      resolveDownload({
        stream: new ReadableStream(),
        headers: {},
        abortOnDisconnect,
      });

      await callPromise;

      expect(abortOnDisconnect).toHaveBeenCalledOnce();
    });

    it('createSkill aborts the signal passed to the service when the request closes', () => {
      const controller = new SkillsController(service as never);
      // Never resolves — this test only cares about the signal, not the response.
      service.createSkill.mockReturnValue(new Promise<never>(() => undefined));

      const req = new EventEmitter() as unknown as Request & {
        user: typeof TEST_USER;
        headers: Record<string, string>;
      };
      req.user = TEST_USER;
      req.headers = {};

      controller.createSkill(
        [{ buffer: Buffer.from('echo hi'), mimetype: 'text/x-sh' }],
        {
          bucket: 'my-bucket',
          path: 'team-a/docs-helper',
          skillManifest: 'manifest',
          filePaths: '["run.sh"]',
        },
        req,
      );

      const [, , , , , , signal] = service.createSkill.mock.calls[0] as [
        string,
        string,
        string,
        string,
        unknown,
        string,
        AbortSignal,
      ];
      expect(signal.aborted).toBe(false);

      req.emit('close');

      expect(signal.aborted).toBe(true);
    });

    it('updateSkill aborts the signal passed to the service when the request closes', () => {
      const controller = new SkillsController(service as never);
      // Never resolves — this test only cares about the signal, not the response.
      service.updateSkill.mockReturnValue(new Promise<never>(() => undefined));

      const req = new EventEmitter() as unknown as Request & {
        user: typeof TEST_USER;
        headers: Record<string, string>;
      };
      req.user = TEST_USER;
      req.headers = { 'if-match': '"etag"' };

      controller.updateSkill(
        [],
        {
          bucket: 'my-bucket',
          path: 'team-a/docs-helper',
          skillManifest: 'manifest',
          filePaths: '[]',
        },
        req,
      );

      const [, , , , , , , signal] = service.updateSkill.mock.calls[0] as [
        string,
        string,
        string,
        string,
        unknown,
        string,
        string,
        AbortSignal,
      ];
      expect(signal.aborted).toBe(false);

      req.emit('close');

      expect(signal.aborted).toBe(true);
    });
  });
});
