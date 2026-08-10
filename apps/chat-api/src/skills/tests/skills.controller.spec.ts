import {
  BadGatewayException,
  BadRequestException,
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
    listSkillFiles: ReturnType<typeof vi.fn>;
    downloadSkill: ReturnType<typeof vi.fn>;
    downloadSkillFile: ReturnType<typeof vi.fn>;
    uploadSkill: ReturnType<typeof vi.fn>;
    uploadSkillFile: ReturnType<typeof vi.fn>;
    deleteSkill: ReturnType<typeof vi.fn>;
    deleteSkillFile: ReturnType<typeof vi.fn>;
    createSkillGroupingFolder: ReturnType<typeof vi.fn>;
    deleteSkillGroupingFolder: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listSkills: vi.fn().mockResolvedValue(mockListResponse),
      listSkillFiles: vi.fn().mockResolvedValue(mockListResponse),
      downloadSkill: vi.fn(),
      downloadSkillFile: vi.fn(),
      uploadSkill: vi.fn(),
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

  describe('PUT /api/v1/skills', () => {
    it('returns 200 and delegates to the service with the uploaded file and If-Match', async () => {
      service.uploadSkill.mockResolvedValue({ etag: '"abc123"' });

      const res = await request(app.getHttpServer())
        .put('/api/v1/skills')
        .set('If-Match', '"prev-etag"')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .attach('file', Buffer.from('zip-bytes'), 'skill.zip')
        .expect(200);

      expect(res.body).toEqual({ etag: '"abc123"' });
      expect(service.uploadSkill).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        expect.objectContaining({ mimetype: expect.any(String) }),
        TEST_USER.at,
        '"prev-etag"',
      );
    });

    /*
     * The controller here mocks SkillsService entirely, so this exercises
     * routing/status-code propagation only — the real zip-slip/reserved-path
     * rejection logic (including the "no upstream call" assertion) is
     * covered against the live SkillsUploadService in
     * skills-upload.service.spec.ts.
     */
    it('returns 400 when the service rejects an unsafe archive entry', async () => {
      service.uploadSkill.mockRejectedValue(
        new BadRequestException('Skill archive contains an invalid entry path'),
      );

      await request(app.getHttpServer())
        .put('/api/v1/skills')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .attach('file', Buffer.from('zip-bytes'), '../../etc/passwd.zip')
        .expect(400);
    });

    it('returns 400 when bucket is missing', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/skills')
        .field('path', 'team-a/docs-helper')
        .attach('file', Buffer.from('zip-bytes'), 'skill.zip')
        .expect(400);
      expect(service.uploadSkill).not.toHaveBeenCalled();
    });

    it('returns 412 when the service throws PreconditionFailedException', async () => {
      service.uploadSkill.mockRejectedValue(new PreconditionFailedException());
      await request(app.getHttpServer())
        .put('/api/v1/skills')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .attach('file', Buffer.from('zip-bytes'), 'skill.zip')
        .expect(412);
    });

    it('returns 413 when the service throws PayloadTooLargeException', async () => {
      service.uploadSkill.mockRejectedValue(new PayloadTooLargeException());
      await request(app.getHttpServer())
        .put('/api/v1/skills')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .attach('file', Buffer.from('zip-bytes'), 'skill.zip')
        .expect(413);
    });

    it('returns 429 when the service throws a 429 HttpException', async () => {
      service.uploadSkill.mockRejectedValue(
        new HttpException('Too many requests', 429),
      );
      await request(app.getHttpServer())
        .put('/api/v1/skills')
        .field('bucket', 'my-bucket')
        .field('path', 'team-a/docs-helper')
        .attach('file', Buffer.from('zip-bytes'), 'skill.zip')
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
});
