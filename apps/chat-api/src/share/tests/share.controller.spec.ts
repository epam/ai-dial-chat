import {
  BadGatewayException,
  INestApplication,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareAccess } from '../dto/create-share-link.dto';
import { ShareLinkResponseDto } from '../dto/share-link-response.dto';
import { ShareController } from '../share.controller';
import { ShareService } from '../share.service';

const TEST_USER = { sub: 'user-123', at: 'test-access-token' };

const createdLink: ShareLinkResponseDto = {
  url: 'https://chat.dialx.ai/marketplace/share/gpt-4o',
  expiresInDays: 3,
  access: [ShareAccess.View],
};

async function buildApp(
  service: unknown,
  injectUser = true,
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ShareController],
    providers: [{ provide: ShareService, useValue: service }],
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

describe('ShareController (integration)', () => {
  let app: INestApplication;
  let service: { createShareLink: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = { createShareLink: vi.fn().mockResolvedValue(createdLink) };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('POST /api/v1/share', () => {
    const validBody = { itemId: 'gpt-4o', access: ['view'] };

    it('delegates to the service and returns 201 with the created share link', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/share')
        .send(validBody)
        .expect(201);

      expect(res.body).toEqual(createdLink);
      expect(service.createShareLink).toHaveBeenCalledWith(
        TEST_USER.at,
        validBody,
      );
    });

    it('returns 400 when access is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/share')
        .send({ itemId: 'gpt-4o', access: ['admin'] })
        .expect(400);

      expect(service.createShareLink).not.toHaveBeenCalled();
    });

    it('returns 400 when access is empty', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/share')
        .send({ itemId: 'gpt-4o', access: [] })
        .expect(400);

      expect(service.createShareLink).not.toHaveBeenCalled();
    });

    it('returns 400 when itemId contains a path traversal attempt', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/share')
        .send({ itemId: '../etc/passwd', access: ['view'] })
        .expect(400);

      expect(service.createShareLink).not.toHaveBeenCalled();
    });

    it('returns 400 when itemId is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/share')
        .send({ access: ['view'] })
        .expect(400);

      expect(service.createShareLink).not.toHaveBeenCalled();
    });

    it('returns 401 when the service throws UnauthorizedException', async () => {
      service.createShareLink.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .post('/api/v1/share')
        .send(validBody)
        .expect(401);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.createShareLink.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .post('/api/v1/share')
        .send(validBody)
        .expect(502);
    });

    it('returns 503 when the service throws ServiceUnavailableException', async () => {
      service.createShareLink.mockRejectedValue(
        new ServiceUnavailableException(),
      );
      await request(app.getHttpServer())
        .post('/api/v1/share')
        .send(validBody)
        .expect(503);
    });
  });
});
