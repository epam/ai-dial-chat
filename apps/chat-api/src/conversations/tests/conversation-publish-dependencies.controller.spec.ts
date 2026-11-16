import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationPublishDependenciesController } from '../conversation-publish-dependencies.controller';
import { ConversationPublishDependenciesService } from '../conversation-publish-dependencies.service';

const TEST_USER = { sub: 'user-123', at: 'test-access-token', bucket: 'b-1' };

describe('ConversationPublishDependenciesController (integration)', () => {
  let app: INestApplication;
  let service: { getDependencies: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = {
      getDependencies: vi.fn().mockResolvedValue({ dependencies: [] }),
    };
    const module = await Test.createTestingModule({
      controllers: [ConversationPublishDependenciesController],
      providers: [
        { provide: ConversationPublishDependenciesService, useValue: service },
      ],
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

  it('returns 200 and passes the caller and the path to the service', async () => {
    service.getDependencies.mockResolvedValue({
      dependencies: [
        {
          id: 'skills/b-1/Docs',
          name: 'Docs',
          type: 'skill',
          location: '',
        },
      ],
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/conversations/publish-dependencies')
      .query({ path: 'gpt-4o__Planning__0b9c' })
      .expect(200);

    expect(res.body.dependencies).toHaveLength(1);
    expect(service.getDependencies).toHaveBeenCalledWith(
      TEST_USER.at,
      TEST_USER.bucket,
      'gpt-4o__Planning__0b9c',
    );
  });

  it('returns 200 with an empty list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/conversations/publish-dependencies')
      .query({ path: 'p' })
      .expect(200);

    expect(res.body).toEqual({ dependencies: [] });
  });

  it('rejects a missing path with 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/conversations/publish-dependencies')
      .expect(400);

    expect(service.getDependencies).not.toHaveBeenCalled();
  });

  it('rejects a project conversation locator with 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/conversations/publish-dependencies')
      .query({ path: 'projects/bucket-1/p-1/conversations/c-1' })
      .expect(400);
  });
});
