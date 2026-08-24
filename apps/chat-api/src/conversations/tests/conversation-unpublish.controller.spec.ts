import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationPublishController } from '../conversation-publish.controller';
import { ConversationPublishService } from '../conversation-publish.service';

const TEST_USER = {
  sid: 'session-123',
  sub: 'user-123',
  providerId: 'keycloak',
  at: 'test-access-token',
  bucket: 'bucket-123',
  csrf: 'csrf-123',
  claims: { name: 'Test User' },
};

const unpublishResult = {
  path: 'conversations/bucket-123/Planning/My%20conversation',
  folderPath: 'Organization/Shared chats',
  requestedAt: '2026-08-13T10:00:00.000Z',
  requestedBy: 'Test User',
};

describe('ConversationPublishController — POST /api/v1/conversations/unpublish', () => {
  let app: INestApplication;
  let service: {
    publish: ReturnType<typeof vi.fn>;
    unpublish: ReturnType<typeof vi.fn>;
    getPublishHistory: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      publish: vi.fn(),
      unpublish: vi.fn().mockResolvedValue(unpublishResult),
      getPublishHistory: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationPublishController],
      providers: [{ provide: ConversationPublishService, useValue: service }],
    }).compile();

    app = module.createNestApplication();
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
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('delegates to the service and returns 200 with the unpublish result', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/conversations/unpublish')
      .query({ path: 'Planning/My conversation' })
      .send({ folderPath: 'Organization/Shared chats' })
      .expect(200);

    expect(response.body).toEqual(unpublishResult);
    expect(service.unpublish).toHaveBeenCalledWith(
      TEST_USER.at,
      TEST_USER.bucket,
      'Planning/My conversation',
      'Organization/Shared chats',
      'Test User',
    );
  });

  it('accepts an empty folderPath, targeting the public root', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/conversations/unpublish')
      .query({ path: 'My conversation' })
      .send({ folderPath: '' })
      .expect(200);

    expect(service.unpublish).toHaveBeenCalledWith(
      TEST_USER.at,
      TEST_USER.bucket,
      'My conversation',
      '',
      'Test User',
    );
  });

  it('rejects a path-traversal folderPath with 400 before reaching the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/conversations/unpublish')
      .query({ path: 'My conversation' })
      .send({ folderPath: '../../etc/passwd' })
      .expect(400);

    expect(service.unpublish).not.toHaveBeenCalled();
  });

  it('rejects an empty conversation path with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/conversations/unpublish')
      .query({ path: '' })
      .send({ folderPath: 'Organization/Shared chats' })
      .expect(400);

    expect(service.unpublish).not.toHaveBeenCalled();
  });

  /*
   * `ConversationPathDto` is shared with rename/delete/duplicate/publish and
   * validates only `IsString` + `MinLength(1)` — it carries no
   * `IsValidFilePath`. So a traversal-shaped `path` reaches the service here
   * exactly as it already does on the publish endpoint; what keeps the request
   * own-bucket is that the service builds `sourceUrl` from the session bucket
   * itself, never from a client-supplied resource url. Asserted so the
   * boundary is recorded rather than assumed.
   */
  it('passes a traversal-shaped path through to the service, as publish does', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/conversations/unpublish')
      .query({ path: '../../other-bucket/conversation' })
      .send({ folderPath: 'Organization/Shared chats' })
      .expect(200);

    expect(service.unpublish).toHaveBeenCalledWith(
      TEST_USER.at,
      TEST_USER.bucket,
      '../../other-bucket/conversation',
      'Organization/Shared chats',
      'Test User',
    );
  });

  it('rejects a rules array with 400, since unpublish must never forward rules', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/conversations/unpublish')
      .query({ path: 'My conversation' })
      .send({ folderPath: 'Organization', rules: [] })
      .expect(400);

    expect(service.unpublish).not.toHaveBeenCalled();
  });

  it('surfaces a service ForbiddenException as 403', async () => {
    service.unpublish.mockRejectedValue(
      new ForbiddenException('No write access to the target folder'),
    );

    await request(app.getHttpServer())
      .post('/api/v1/conversations/unpublish')
      .query({ path: 'My conversation' })
      .send({ folderPath: 'Organization/Shared chats' })
      .expect(403);
  });

  it('surfaces a service NotFoundException as 404', async () => {
    service.unpublish.mockRejectedValue(
      new NotFoundException('Conversation not found'),
    );

    await request(app.getHttpServer())
      .post('/api/v1/conversations/unpublish')
      .query({ path: 'My conversation' })
      .send({ folderPath: 'Organization/Shared chats' })
      .expect(404);
  });
});
