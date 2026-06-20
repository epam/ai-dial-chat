import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserConfigController } from '../user-config.controller';
import { UserConfigService } from '../user-config.service';

const TEST_USER = {
  sid: 'test-sid',
  sub: 'test-sub',
  providerId: 'keycloak',
  at: 'test-access-token',
  bucket: 'test-bucket',
  claims: {},
  csrf: 'test-csrf',
};

describe('UserConfigController (integration)', () => {
  let app: INestApplication;
  let service: {
    readConfig: ReturnType<typeof vi.fn>;
    updatePin: ReturnType<typeof vi.fn>;
    updateInstalledToolset: ReturnType<typeof vi.fn>;
    updateInstalledDeployment: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      readConfig: vi.fn(),
      updatePin: vi.fn(),
      updateInstalledToolset: vi.fn(),
      updateInstalledDeployment: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserConfigController],
      providers: [{ provide: UserConfigService, useValue: service }],
    }).compile();

    app = module.createNestApplication();
    app.use(
      (req: ExpressRequest, _res: ExpressResponse, next: NextFunction) => {
        req.user = TEST_USER;
        next();
      },
    );
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
    it('returns 200 with the v2 user config', async () => {
      const config = {
        version: 2,
        conversations: { pinnedIds: ['conv-1'] },
        toolsets: { installed: ['toolset-abc'] },
        deployments: { installed: [] },
      };
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

  describe('PATCH /user-config/toolsets', () => {
    it('returns 204 for a valid install request', async () => {
      service.updateInstalledToolset.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/toolsets')
        .send({ id: 'toolset-abc', isInstalled: true })
        .expect(204);

      expect(service.updateInstalledToolset).toHaveBeenCalledWith(
        'toolset-abc',
        true,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 204 for a valid uninstall request', async () => {
      service.updateInstalledToolset.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/toolsets')
        .send({ id: 'toolset-abc', isInstalled: false })
        .expect(204);

      expect(service.updateInstalledToolset).toHaveBeenCalledWith(
        'toolset-abc',
        false,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 400 when id is missing', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/toolsets')
        .send({ isInstalled: true })
        .expect(400);
    });

    it('returns 400 when isInstalled is not a boolean', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/toolsets')
        .send({ id: 'toolset-abc', isInstalled: 'yes' })
        .expect(400);
    });

    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/toolsets')
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /user-config/deployments', () => {
    it('returns 204 for a valid install request', async () => {
      service.updateInstalledDeployment.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/deployments')
        .send({ id: 'deployment-xyz', isInstalled: true })
        .expect(204);

      expect(service.updateInstalledDeployment).toHaveBeenCalledWith(
        'deployment-xyz',
        true,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 204 for a valid uninstall request', async () => {
      service.updateInstalledDeployment.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/user-config/deployments')
        .send({ id: 'deployment-xyz', isInstalled: false })
        .expect(204);

      expect(service.updateInstalledDeployment).toHaveBeenCalledWith(
        'deployment-xyz',
        false,
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 400 when id is missing', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/deployments')
        .send({ isInstalled: true })
        .expect(400);
    });

    it('returns 400 when isInstalled is not a boolean', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/deployments')
        .send({ id: 'deployment-xyz', isInstalled: 'yes' })
        .expect(400);
    });

    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .patch('/user-config/deployments')
        .send({})
        .expect(400);
    });
  });
});
