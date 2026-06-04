import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserConfigController } from '../user-config.controller';
import { UserConfigService } from '../user-config.service';

const TEST_USER = {
  at: 'test-access-token',
  bucket: 'test-bucket',
};

describe('UserConfigController (integration)', () => {
  let app: INestApplication;
  let service: {
    readConfig: ReturnType<typeof vi.fn>;
    updatePin: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      readConfig: vi.fn(),
      updatePin: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserConfigController],
      providers: [{ provide: UserConfigService, useValue: service }],
    }).compile();

    app = module.createNestApplication();
    app.use((req, _res, next) => {
      req.user = TEST_USER;
      next();
    });
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

  describe('GET /user-config', () => {
    it('returns 200 with the user config', async () => {
      const config = { version: 1, pinnedConversationIds: ['conv-1'] };
      service.readConfig.mockResolvedValue(config);

      const result = await request(app.getHttpServer())
        .get('/user-config')
        .expect(200);

      expect(result.body).toEqual(config);
      expect(service.readConfig).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });
  });

  describe('PATCH /user-config/pins', () => {
    it('returns 204 for a valid pin request', async () => {
      service.updatePin.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/pins')
        .send({
          path: 'conversations/test-bucket/gpt-4o__Hello__uuid',
          isPinned: true,
        })
        .expect(204);

      expect(service.updatePin).toHaveBeenCalledWith(
        'conversations/test-bucket/gpt-4o__Hello__uuid',
        true,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 204 for a valid unpin request', async () => {
      service.updatePin.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/pins')
        .send({
          path: 'conversations/test-bucket/gpt-4o__Hello__uuid',
          isPinned: false,
        })
        .expect(204);

      expect(service.updatePin).toHaveBeenCalledWith(
        'conversations/test-bucket/gpt-4o__Hello__uuid',
        false,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 400 when path is missing', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/pins')
        .send({ isPinned: true })
        .expect(400);
    });

    it('returns 400 when isPinned is missing', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/pins')
        .send({ path: 'conversations/test-bucket/some-id' })
        .expect(400);
    });

    it('returns 400 when isPinned is not a boolean', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/pins')
        .send({ path: 'conversations/test-bucket/some-id', isPinned: 'yes' })
        .expect(400);
    });

    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/pins')
        .send({})
        .expect(400);
    });
  });
});
