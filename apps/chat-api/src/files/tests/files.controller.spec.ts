import {
  BadGatewayException,
  ConflictException,
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
import { memoryStorage } from 'multer';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilesController } from '../files.controller';
import { FilesService } from '../files.service';

const TEST_USER = {
  sub: 'user-123',
  at: 'test-access-token',
  bucket: 'user-bucket',
};

const MOCK_LIST_RESPONSE = {
  bucket: 'my-bucket',
  path: '',
  items: [
    {
      name: 'folder',
      path: 'folder/',
      folderId: 'my-bucket:folder/',
      nodeType: 'folder',
      bucket: 'my-bucket',
    },
  ],
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
      undefined,
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
      undefined,
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

  it('passes uploadMode to service when provided', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', 'folder/file.pdf')
      .field('uploadMode', 'create-only')
      .attach('file', Buffer.from('hello'), 'file.pdf')
      .expect(201);

    expect(service.uploadFile).toHaveBeenCalledWith(
      'my-bucket',
      'folder/file.pdf',
      expect.any(Object),
      TEST_USER.at,
      'create-only',
    );
  });

  it('returns 400 for invalid uploadMode value', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', 'folder/file.pdf')
      .field('uploadMode', 'invalid-mode')
      .attach('file', Buffer.from('hello'), 'file.pdf')
      .expect(400);
    expect(service.uploadFile).not.toHaveBeenCalled();
  });

  it('returns 409 when service throws ConflictException (race in create-only mode)', async () => {
    service.uploadFile.mockRejectedValue(
      new ConflictException('File already exists at this path'),
    );
    await request(app.getHttpServer())
      .post('/api/v1/files')
      .field('bucket', 'my-bucket')
      .field('path', 'folder/file.pdf')
      .field('uploadMode', 'create-only')
      .attach('file', Buffer.from('hello'), 'file.pdf')
      .expect(409);
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

describe('FilesController — createFolder', () => {
  let app: INestApplication;
  let service: {
    uploadFile: ReturnType<typeof vi.fn>;
    downloadFile: ReturnType<typeof vi.fn>;
    listFiles: ReturnType<typeof vi.fn>;
    createFolder: ReturnType<typeof vi.fn>;
  };

  const MOCK_FOLDER_RESPONSE = {
    name: 'reports',
    path: 'reports/',
    parentPath: '',
    bucket: 'my-bucket',
    nodeType: 'folder',
    folderId: 'my-bucket:reports/',
  };

  beforeEach(async () => {
    service = {
      uploadFile: vi.fn(),
      downloadFile: vi.fn(),
      listFiles: vi.fn(),
      createFolder: vi.fn().mockResolvedValue(MOCK_FOLDER_RESPONSE),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 201 with CreateFolderResponseDto on success', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/files/folders')
      .send({ bucket: 'my-bucket', name: 'reports' })
      .expect(201);

    expect(res.body).toEqual(MOCK_FOLDER_RESPONSE);
    expect(service.createFolder).toHaveBeenCalledWith(
      'my-bucket',
      '',
      'reports',
      TEST_USER.at,
    );
  });

  it('returns 201 with parentPath when provided', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files/folders')
      .send({ bucket: 'my-bucket', parentPath: 'parent/', name: 'child' })
      .expect(201);

    expect(service.createFolder).toHaveBeenCalledWith(
      'my-bucket',
      'parent/',
      'child',
      TEST_USER.at,
    );
  });

  it('returns 400 for missing name', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files/folders')
      .send({ bucket: 'my-bucket' })
      .expect(400);
    expect(service.createFolder).not.toHaveBeenCalled();
  });

  it('returns 400 for name starting with dot', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files/folders')
      .send({ bucket: 'my-bucket', name: '.hidden' })
      .expect(400);
    expect(service.createFolder).not.toHaveBeenCalled();
  });

  it('returns 400 for name containing slash', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files/folders')
      .send({ bucket: 'my-bucket', name: 'a/b' })
      .expect(400);
    expect(service.createFolder).not.toHaveBeenCalled();
  });

  it('returns 400 for reserved marker name', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files/folders')
      .send({ bucket: 'my-bucket', name: '.dial_folder' })
      .expect(400);
    expect(service.createFolder).not.toHaveBeenCalled();
  });

  it('returns 409 when service throws ConflictException', async () => {
    service.createFolder.mockRejectedValue(new ConflictException());
    await request(app.getHttpServer())
      .post('/api/v1/files/folders')
      .send({ bucket: 'my-bucket', name: 'reports' })
      .expect(409);
  });

  it('returns 401 when service throws UnauthorizedException', async () => {
    service.createFolder.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())
      .post('/api/v1/files/folders')
      .send({ bucket: 'my-bucket', name: 'reports' })
      .expect(401);
  });

  it('returns 503 when service throws ServiceUnavailableException', async () => {
    service.createFolder.mockRejectedValue(new ServiceUnavailableException());
    await request(app.getHttpServer())
      .post('/api/v1/files/folders')
      .send({ bucket: 'my-bucket', name: 'reports' })
      .expect(503);
  });
});

describe('FilesController — listFiles', () => {
  let app: INestApplication;
  let service: {
    uploadFile: ReturnType<typeof vi.fn>;
    downloadFile: ReturnType<typeof vi.fn>;
    listFiles: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      uploadFile: vi.fn(),
      downloadFile: vi.fn(),
      listFiles: vi.fn().mockResolvedValue(MOCK_LIST_RESPONSE),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 200 with ListFilesResponseDto shape for valid bucket', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/files/list')
      .query({ bucket: 'my-bucket' })
      .expect(200);

    expect(res.body).toMatchObject({
      bucket: 'my-bucket',
      items: expect.any(Array),
    });
  });

  it('returns 200 with items array for bucket + path + limit', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/files/list')
      .query({ bucket: 'my-bucket', path: 'folder/', limit: '10' })
      .expect(200);

    expect(res.body.items).toBeInstanceOf(Array);
  });

  it('returns 400 when bucket is missing', async () => {
    await request(app.getHttpServer()).get('/api/v1/files/list').expect(400);
    expect(service.listFiles).not.toHaveBeenCalled();
  });

  it('returns 400 for bucket with slash', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/list')
      .query({ bucket: 'my/bucket' })
      .expect(400);
    expect(service.listFiles).not.toHaveBeenCalled();
  });

  it('returns 400 for path with ..', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/list')
      .query({ bucket: 'my-bucket', path: '../../etc' })
      .expect(400);
    expect(service.listFiles).not.toHaveBeenCalled();
  });

  it('returns 400 for limit=0', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/list')
      .query({ bucket: 'my-bucket', limit: '0' })
      .expect(400);
    expect(service.listFiles).not.toHaveBeenCalled();
  });

  it('returns 400 for limit=1001', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/list')
      .query({ bucket: 'my-bucket', limit: '1001' })
      .expect(400);
    expect(service.listFiles).not.toHaveBeenCalled();
  });

  it('returns 403 when service throws ForbiddenException', async () => {
    service.listFiles.mockRejectedValue(new ForbiddenException());
    await request(app.getHttpServer())
      .get('/api/v1/files/list')
      .query({ bucket: 'my-bucket' })
      .expect(403);
  });

  it('returns 404 when service throws NotFoundException', async () => {
    service.listFiles.mockRejectedValue(new NotFoundException());
    await request(app.getHttpServer())
      .get('/api/v1/files/list')
      .query({ bucket: 'my-bucket' })
      .expect(404);
  });

  it('returns 429 when service throws TooManyRequestsException', async () => {
    service.listFiles.mockRejectedValue(
      new HttpException('Too many requests', 429),
    );
    await request(app.getHttpServer())
      .get('/api/v1/files/list')
      .query({ bucket: 'my-bucket' })
      .expect(429);
  });

  it('returns 502 when service throws BadGatewayException', async () => {
    service.listFiles.mockRejectedValue(new BadGatewayException());
    await request(app.getHttpServer())
      .get('/api/v1/files/list')
      .query({ bucket: 'my-bucket' })
      .expect(502);
  });

  it('returns 503 when service throws ServiceUnavailableException', async () => {
    service.listFiles.mockRejectedValue(new ServiceUnavailableException());
    await request(app.getHttpServer())
      .get('/api/v1/files/list')
      .query({ bucket: 'my-bucket' })
      .expect(503);
  });

  it('returns 401 when unauthenticated (no user on request)', async () => {
    service.listFiles.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())
      .get('/api/v1/files/list')
      .query({ bucket: 'my-bucket' })
      .expect(401);
  });
});

describe('FilesController — getFileMetadata', () => {
  const MOCK_METADATA = {
    name: 'file.pdf',
    nodeType: 'item',
    bucket: 'my-bucket',
    parentPath: 'folder/',
    url: 'files/my-bucket/folder/file.pdf',
    resourceType: 'file',
    etag: '"abc123"',
    contentLength: 204800,
    contentType: 'application/pdf',
    updatedAt: 1712345678000,
    permissions: ['READ'],
  };

  let app: INestApplication;
  let service: {
    uploadFile: ReturnType<typeof vi.fn>;
    downloadFile: ReturnType<typeof vi.fn>;
    listFiles: ReturnType<typeof vi.fn>;
    getFileMetadata: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      uploadFile: vi.fn(),
      downloadFile: vi.fn(),
      listFiles: vi.fn(),
      getFileMetadata: vi.fn().mockResolvedValue(MOCK_METADATA),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 200 with FileMetadataResponseDto shape for a valid request', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/files/metadata')
      .query({ bucket: 'my-bucket', path: 'folder/file.pdf' })
      .expect(200);

    expect(res.body).toMatchObject({
      name: 'file.pdf',
      nodeType: 'item',
      etag: '"abc123"',
    });
    expect(service.getFileMetadata).toHaveBeenCalledWith(
      'my-bucket',
      'folder/file.pdf',
      TEST_USER.at,
    );
  });

  it('returns 400 when bucket is missing', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/metadata')
      .query({ path: 'folder/file.pdf' })
      .expect(400);
    expect(service.getFileMetadata).not.toHaveBeenCalled();
  });

  it('returns 400 when bucket contains invalid characters', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/metadata')
      .query({ bucket: 'bad/bucket', path: 'file.pdf' })
      .expect(400);
    expect(service.getFileMetadata).not.toHaveBeenCalled();
  });

  it('returns 400 when path is empty', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/metadata')
      .query({ bucket: 'my-bucket', path: '' })
      .expect(400);
    expect(service.getFileMetadata).not.toHaveBeenCalled();
  });

  it('returns 400 when path is absent', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/metadata')
      .query({ bucket: 'my-bucket' })
      .expect(400);
    expect(service.getFileMetadata).not.toHaveBeenCalled();
  });

  it('returns 400 when path ends with /', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/metadata')
      .query({ bucket: 'my-bucket', path: 'folder/' })
      .expect(400);
    expect(service.getFileMetadata).not.toHaveBeenCalled();
  });

  it('returns 400 when path contains ..', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/metadata')
      .query({ bucket: 'my-bucket', path: '../../etc/passwd' })
      .expect(400);
    expect(service.getFileMetadata).not.toHaveBeenCalled();
  });

  it('returns 401 when service throws UnauthorizedException', async () => {
    service.getFileMetadata.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())
      .get('/api/v1/files/metadata')
      .query({ bucket: 'my-bucket', path: 'file.pdf' })
      .expect(401);
  });

  it('returns 403 when service throws ForbiddenException', async () => {
    service.getFileMetadata.mockRejectedValue(new ForbiddenException());
    await request(app.getHttpServer())
      .get('/api/v1/files/metadata')
      .query({ bucket: 'my-bucket', path: 'file.pdf' })
      .expect(403);
  });

  it('returns 404 when service throws NotFoundException', async () => {
    service.getFileMetadata.mockRejectedValue(new NotFoundException());
    await request(app.getHttpServer())
      .get('/api/v1/files/metadata')
      .query({ bucket: 'my-bucket', path: 'file.pdf' })
      .expect(404);
  });

  it('returns 502 when service throws BadGatewayException', async () => {
    service.getFileMetadata.mockRejectedValue(new BadGatewayException());
    await request(app.getHttpServer())
      .get('/api/v1/files/metadata')
      .query({ bucket: 'my-bucket', path: 'file.pdf' })
      .expect(502);
  });

  it('returns 503 when service throws ServiceUnavailableException', async () => {
    service.getFileMetadata.mockRejectedValue(
      new ServiceUnavailableException(),
    );
    await request(app.getHttpServer())
      .get('/api/v1/files/metadata')
      .query({ bucket: 'my-bucket', path: 'file.pdf' })
      .expect(503);
  });
});

describe('FilesController — listPublicFiles', () => {
  const MOCK_PUBLIC_RESPONSE = {
    bucket: 'public',
    path: '',
    items: [
      {
        name: 'readme.md',
        path: 'readme.md',
        folderId: 'public:',
        nodeType: 'item',
        bucket: 'public',
      },
    ],
  };

  let app: INestApplication;
  let service: {
    listPublicFiles: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listPublicFiles: vi.fn().mockResolvedValue(MOCK_PUBLIC_RESPONSE),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 200 with ListFilesResponseDto shape on success', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/files/public')
      .expect(200);

    expect(res.body).toMatchObject({
      bucket: 'public',
      items: expect.any(Array),
    });
    expect(service.listPublicFiles).toHaveBeenCalledWith(
      {
        path: undefined,
        token: undefined,
        limit: undefined,
        recursive: undefined,
      },
      TEST_USER.at,
    );
  });

  it('returns 200 with empty items array when public bucket is empty', async () => {
    service.listPublicFiles.mockResolvedValue({
      bucket: 'public',
      path: '',
      items: [],
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/files/public')
      .expect(200);

    expect(res.body.items).toEqual([]);
  });

  it('returns 400 for path with ..', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/files/public')
      .query({ path: '../../etc' })
      .expect(400);
    expect(service.listPublicFiles).not.toHaveBeenCalled();
  });

  it('returns 401 when service throws UnauthorizedException', async () => {
    service.listPublicFiles.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer()).get('/api/v1/files/public').expect(401);
  });

  it('returns 502 when service throws BadGatewayException', async () => {
    service.listPublicFiles.mockRejectedValue(new BadGatewayException());
    await request(app.getHttpServer()).get('/api/v1/files/public').expect(502);
  });
});

describe('FilesController — listSharedFiles', () => {
  const MOCK_SHARED_RESPONSE = {
    bucket: '',
    path: '',
    items: [
      {
        name: 'shared-doc.pdf',
        path: 'shared-doc.pdf',
        folderId: 'user-bucket:',
        nodeType: 'item',
        bucket: 'user-bucket',
      },
    ],
  };

  let app: INestApplication;
  let service: {
    listSharedFiles: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listSharedFiles: vi.fn().mockResolvedValue(MOCK_SHARED_RESPONSE),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 200 with shared items on success', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/files/shared')
      .expect(200);

    expect(res.body).toMatchObject({ items: expect.any(Array) });
    expect(service.listSharedFiles).toHaveBeenCalledWith(
      { path: undefined, token: undefined, limit: undefined },
      TEST_USER.at,
    );
  });

  it('returns 200 with empty items array when no files are shared', async () => {
    service.listSharedFiles.mockResolvedValue({
      bucket: '',
      path: '',
      items: [],
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/files/shared')
      .expect(200);

    expect(res.body.items).toEqual([]);
  });

  it('returns 401 when service throws UnauthorizedException', async () => {
    service.listSharedFiles.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer()).get('/api/v1/files/shared').expect(401);
  });

  it('returns 502 when service throws BadGatewayException', async () => {
    service.listSharedFiles.mockRejectedValue(new BadGatewayException());
    await request(app.getHttpServer()).get('/api/v1/files/shared').expect(502);
  });
});

describe('FilesController — deleteFiles', () => {
  const MOCK_DELETE_RESPONSE = {
    results: [
      { path: 'reports/q1.pdf', success: true },
      { path: 'old-data/', success: true },
    ],
  };

  let app: INestApplication;
  let service: { deleteFiles: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = {
      deleteFiles: vi.fn().mockResolvedValue(MOCK_DELETE_RESPONSE),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 200 with results array on success', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/files/delete')
      .send({
        items: [
          {
            bucket: 'user-files',
            path: 'reports/q1.pdf',
            name: 'q1.pdf',
            nodeType: 'item',
          },
          {
            bucket: 'user-files',
            path: 'old-data/',
            name: 'old-data',
            nodeType: 'folder',
          },
        ],
      })
      .expect(200);

    expect(res.body).toEqual(MOCK_DELETE_RESPONSE);
    expect(service.deleteFiles).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ path: 'reports/q1.pdf', nodeType: 'item' }),
        expect.objectContaining({ path: 'old-data/', nodeType: 'folder' }),
      ]),
      TEST_USER.at,
    );
  });

  it('returns 400 when items array is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files/delete')
      .send({})
      .expect(400);
    expect(service.deleteFiles).not.toHaveBeenCalled();
  });

  it('returns 400 when items array is empty', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files/delete')
      .send({ items: [] })
      .expect(400);
    expect(service.deleteFiles).not.toHaveBeenCalled();
  });

  it('returns 401 when service throws UnauthorizedException', async () => {
    service.deleteFiles.mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())
      .post('/api/v1/files/delete')
      .send({
        items: [
          {
            bucket: 'user-files',
            path: 'file.pdf',
            name: 'file.pdf',
            nodeType: 'item',
          },
        ],
      })
      .expect(401);
  });
});
