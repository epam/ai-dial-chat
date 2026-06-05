import {
  ForbiddenException,
  HttpException,
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilesController } from '../files.controller';
import { FilesService } from '../files.service';

const { memoryStorage } = require('multer') as { memoryStorage: () => unknown };

const TEST_USER = {
  sub: 'user-123',
  at: 'test-access-token',
  bucket: 'user-bucket',
};

async function buildApp(
  service: unknown,
  opts: { fileSizeLimit?: number; injectUser?: boolean } = {},
): Promise<INestApplication> {
  const { fileSizeLimit, injectUser = true } = opts;
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      MulterModule.register({
        storage: memoryStorage(),
        limits:
          fileSizeLimit !== undefined ? { fileSize: fileSizeLimit } : undefined,
      }),
    ],
    controllers: [FilesController],
    providers: [{ provide: FilesService, useValue: service }],
  }).compile();

  const app = module.createNestApplication();
  if (injectUser) {
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
}

describe('FilesController — upload', () => {
  let app: INestApplication;
  let service: {
    uploadFile: ReturnType<typeof vi.fn>;
    downloadFile: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      uploadFile: vi
        .fn()
        .mockResolvedValue({ url: 'files/my-bucket/folder/file.pdf' }),
      downloadFile: vi.fn(),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 201 with url on successful upload', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', 'folder/file.pdf')
      .attach('file', Buffer.from('hello'), 'file.pdf')
      .expect(201);

    expect(res.body).toEqual({ url: 'files/my-bucket/folder/file.pdf' });
    expect(service.uploadFile).toHaveBeenCalledWith(
      'my-bucket',
      'folder/file.pdf',
      expect.objectContaining({
        buffer: expect.any(Buffer),
        mimetype: expect.any(String),
      }),
      TEST_USER.at,
    );
  });

  it('accepts percent-encoded file names in user upload paths', async () => {
    const path = 'uploads/2026-06/IMG_4740%202.jpg';

    const res = await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'user-bucket')
      .field('path', path)
      .attach('file', Buffer.from('hello'), 'IMG_4740 2.jpg')
      .expect(201);

    expect(res.body).toEqual({ url: 'files/my-bucket/folder/file.pdf' });
    expect(service.uploadFile).toHaveBeenCalledWith(
      'user-bucket',
      path,
      expect.objectContaining({
        buffer: expect.any(Buffer),
        mimetype: expect.any(String),
      }),
      TEST_USER.at,
    );
  });

  it('returns 400 for invalid bucket (contains slash)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'bad/bucket')
      .field('path', 'folder/file.pdf')
      .attach('file', Buffer.from('hello'), 'file.pdf')
      .expect(400);
    expect(service.uploadFile).not.toHaveBeenCalled();
  });

  it('returns 400 for path traversal (..)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', '../etc/passwd')
      .attach('file', Buffer.from('hello'), 'file.pdf')
      .expect(400);
    expect(service.uploadFile).not.toHaveBeenCalled();
  });

  it('returns 400 for URL-encoded path traversal', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', 'files/my-bucket/uploads/2026-06/%2E%2E%2Fsecret.txt')
      .attach('file', Buffer.from('hello'), 'secret.txt')
      .expect(400);
    expect(service.uploadFile).not.toHaveBeenCalled();
  });

  it('returns 400 for path starting with /', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', '/etc/passwd')
      .attach('file', Buffer.from('hello'), 'file.pdf')
      .expect(400);
    expect(service.uploadFile).not.toHaveBeenCalled();
  });

  it('returns 401 when no session (unauthenticated)', async () => {
    service.uploadFile.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', 'folder/file.pdf')
      .attach('file', Buffer.from('hello'), 'file.pdf')
      .expect(401);
  });

  it('returns 413 when multer rejects oversized file', async () => {
    await app.close();
    app = await buildApp(service, { fileSizeLimit: 1 });
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', 'folder/file.pdf')
      .attach('file', Buffer.from('hello world'), 'file.pdf')
      .expect(413);
  });

  it('returns 403 when service throws ForbiddenException', async () => {
    service.uploadFile.mockRejectedValue(new ForbiddenException());
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', 'folder/file.pdf')
      .attach('file', Buffer.from('hello'), 'file.pdf')
      .expect(403);
  });

  it('returns 429 when service throws 429 HttpException', async () => {
    service.uploadFile.mockRejectedValue(
      new HttpException('Too many requests', 429),
    );
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', 'folder/file.pdf')
      .attach('file', Buffer.from('hello'), 'file.pdf')
      .expect(429);
  });

  it('returns 503 when service throws ServiceUnavailableException', async () => {
    service.uploadFile.mockRejectedValue(new ServiceUnavailableException());
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', 'folder/file.pdf')
      .attach('file', Buffer.from('hello'), 'file.pdf')
      .expect(503);
  });

  it('returns 503 when service throws ServiceUnavailableException (5xx from DIAL Core)', async () => {
    service.uploadFile.mockRejectedValue(new ServiceUnavailableException());
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', 'folder/file.pdf')
      .attach('file', Buffer.from('hello'), 'file.pdf')
      .expect(503);
  });
});

describe('FilesController — download', () => {
  let app: INestApplication;
  let service: {
    uploadFile: ReturnType<typeof vi.fn>;
    downloadFile: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const body = 'binary-content';
    const webStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    });
    service = {
      uploadFile: vi.fn(),
      downloadFile: vi.fn().mockResolvedValue({
        stream: webStream,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="file.pdf"',
          'content-length': String(body.length),
        },
      }),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 200 with binary body and forwarded headers', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/files/download')
      .query({ bucket: 'my-bucket', path: 'folder/file.pdf' })
      .expect(200);

    expect(res.headers['content-type']).toMatch('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="file.pdf"',
    );
    expect(service.downloadFile).toHaveBeenCalledWith(
      'my-bucket',
      'folder/file.pdf',
      TEST_USER.at,
    );
  });

  it('returns 400 for invalid bucket (contains colon)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/download')
      .query({ bucket: 'bad:bucket', path: 'file.pdf' })
      .expect(400);
  });

  it('returns 400 for path traversal', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/download')
      .query({ bucket: 'my-bucket', path: '../etc/passwd' })
      .expect(400);
  });

  it('returns 404 when service throws NotFoundException', async () => {
    service.downloadFile.mockRejectedValue(new NotFoundException());
    await request(app.getHttpServer())
      .get('/api/v1/files/download')
      .query({ bucket: 'my-bucket', path: 'missing.pdf' })
      .expect(404);
  });

  it('returns 401 when service throws UnauthorizedException', async () => {
    service.downloadFile.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())
      .get('/api/v1/files/download')
      .query({ bucket: 'my-bucket', path: 'file.pdf' })
      .expect(401);
  });

  it('returns 503 when service throws ServiceUnavailableException', async () => {
    service.downloadFile.mockRejectedValue(new ServiceUnavailableException());
    await request(app.getHttpServer())
      .get('/api/v1/files/download')
      .query({ bucket: 'my-bucket', path: 'file.pdf' })
      .expect(503);
  });
});
