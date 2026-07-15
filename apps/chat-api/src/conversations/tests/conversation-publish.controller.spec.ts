import {
  BadGatewayException,
  INestApplication,
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

const publishResult = {
  path: 'conversations/bucket-123/Planning/My%20conversation',
  folderPath: 'Organization/Data Science',
  publishedAt: '2026-07-15T10:00:00.000Z',
  publishedBy: 'Test User',
};

describe('ConversationPublishController (integration)', () => {
  let app: INestApplication;
  let service: {
    publish: ReturnType<typeof vi.fn>;
    getPublishHistory: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      publish: vi.fn().mockResolvedValue(publishResult),
      getPublishHistory: vi.fn().mockResolvedValue([publishResult]),
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
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('publishes a conversation through the versioned endpoint', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/conversations/publish')
      .query({ path: 'Planning/My conversation' })
      .send({ folderPath: 'Organization/Data Science' })
      .expect(201);

    expect(response.body).toEqual(publishResult);
    expect(service.publish).toHaveBeenCalledWith(
      TEST_USER.at,
      TEST_USER.bucket,
      'Planning/My conversation',
      'Organization/Data Science',
      'Test User',
    );
  });

  it('rejects a publish request without a conversation path', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/conversations/publish')
      .send({ folderPath: 'Organization' })
      .expect(400);

    expect(service.publish).not.toHaveBeenCalled();
  });

  it('rejects a publish request with a traversing folder path', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/conversations/publish')
      .query({ path: 'my-conversation' })
      .send({ folderPath: '../private' })
      .expect(400);

    expect(service.publish).not.toHaveBeenCalled();
  });

  it('maps service failures to their HTTP status', async () => {
    service.publish.mockRejectedValue(new BadGatewayException());

    await request(app.getHttpServer())
      .post('/api/v1/conversations/publish')
      .query({ path: 'my-conversation' })
      .send({ folderPath: 'Organization' })
      .expect(502);
  });

  it('returns publish history through the versioned endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/conversations/publish-history')
      .query({ path: 'Planning/My conversation' })
      .expect(200);

    expect(response.body).toEqual([publishResult]);
    expect(service.getPublishHistory).toHaveBeenCalledWith(
      TEST_USER.at,
      TEST_USER.bucket,
      'Planning/My conversation',
    );
  });

  it('rejects a history request without a conversation path', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/conversations/publish-history')
      .expect(400);

    expect(service.getPublishHistory).not.toHaveBeenCalled();
  });
});
