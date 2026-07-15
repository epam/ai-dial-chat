import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcceptInvitationResponseDto } from '../dto/accept-invitation-response.dto';
import { ShareAccess } from '../dto/create-share-link.dto';
import type { DiscardSharedCatalogItemResponseDto } from '../dto/discard-shared-catalog-item.dto';
import { ShareLinkResponseDto } from '../dto/share-link-response.dto';
import { ShareController } from '../share.controller';
import { ShareService } from '../share.service';

const TEST_USER = { sub: 'user-123', at: 'test-access-token' };

const createdLink: ShareLinkResponseDto = {
  url: 'https://example.com/marketplace/share/gpt-4o',
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

const acceptedInvitation: AcceptInvitationResponseDto = { itemId: 'gpt-4o' };
const discardedSuccess: DiscardSharedCatalogItemResponseDto = {
  success: true,
};

describe('ShareController (integration)', () => {
  let app: INestApplication;
  let service: {
    createShareLink: ReturnType<typeof vi.fn>;
    acceptInvitation: ReturnType<typeof vi.fn>;
    discardShared: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      createShareLink: vi.fn().mockResolvedValue(createdLink),
      acceptInvitation: vi.fn().mockResolvedValue(acceptedInvitation),
      discardShared: vi.fn().mockResolvedValue(discardedSuccess),
    };
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

  describe('GET /api/v1/share/invitations/:invitationId', () => {
    it('delegates to the service and returns 200 with the shared itemId', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/share/invitations/abc123')
        .expect(200);

      expect(res.body).toEqual(acceptedInvitation);
      expect(service.acceptInvitation).toHaveBeenCalledWith(
        TEST_USER.at,
        'abc123',
        TEST_USER.sub,
      );
    });

    it('returns 400 when invitationId contains unsupported characters', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/share/invitations/abc%2F123')
        .expect(400);

      expect(service.acceptInvitation).not.toHaveBeenCalled();
    });

    it('returns 401 when the service throws UnauthorizedException', async () => {
      service.acceptInvitation.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .get('/api/v1/share/invitations/abc123')
        .expect(401);
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.acceptInvitation.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .get('/api/v1/share/invitations/abc123')
        .expect(404);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.acceptInvitation.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .get('/api/v1/share/invitations/abc123')
        .expect(502);
    });

    it('returns 503 when the service throws ServiceUnavailableException', async () => {
      service.acceptInvitation.mockRejectedValue(
        new ServiceUnavailableException(),
      );
      await request(app.getHttpServer())
        .get('/api/v1/share/invitations/abc123')
        .expect(503);
    });
  });

  describe('POST /api/v1/share/discard', () => {
    const validBody = { itemId: 'applications/owner-bucket/my-app' };

    it('delegates to the service and returns 200 on success', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/share/discard')
        .send(validBody)
        .expect(200);

      expect(res.body).toEqual(discardedSuccess);
      expect(service.discardShared).toHaveBeenCalledWith(
        validBody.itemId,
        TEST_USER.at,
        TEST_USER.sub,
      );
    });

    it('returns 400 when itemId is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/share/discard')
        .send({})
        .expect(400);

      expect(service.discardShared).not.toHaveBeenCalled();
    });

    it.each([
      'conversations/owner-bucket/my-chat',
      'files/owner-bucket/report.pdf',
      'gpt-4o',
      'applications/owner-bucket',
    ])(
      'returns 400 when itemId is not a catalog resource: %s',
      async (itemId) => {
        await request(app.getHttpServer())
          .post('/api/v1/share/discard')
          .send({ itemId })
          .expect(400);

        expect(service.discardShared).not.toHaveBeenCalled();
      },
    );

    it('accepts a nested toolset resource path', async () => {
      const itemId = 'toolsets/owner-bucket/folder/my-toolset';

      await request(app.getHttpServer())
        .post('/api/v1/share/discard')
        .send({ itemId })
        .expect(200);

      expect(service.discardShared).toHaveBeenCalledWith(
        itemId,
        TEST_USER.at,
        TEST_USER.sub,
      );
    });

    it('returns 400 when itemId contains a path traversal attempt', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/share/discard')
        .send({ itemId: '../etc/passwd' })
        .expect(400);

      expect(service.discardShared).not.toHaveBeenCalled();
    });

    it('returns 401 when the service throws UnauthorizedException', async () => {
      service.discardShared.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .post('/api/v1/share/discard')
        .send(validBody)
        .expect(401);
    });

    it('returns 403 when the service throws ForbiddenException', async () => {
      service.discardShared.mockRejectedValue(new ForbiddenException());
      await request(app.getHttpServer())
        .post('/api/v1/share/discard')
        .send(validBody)
        .expect(403);
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      service.discardShared.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .post('/api/v1/share/discard')
        .send(validBody)
        .expect(404);
    });

    it('returns 429 when the service throws a 429 HttpException', async () => {
      service.discardShared.mockRejectedValue(
        new HttpException('Too Many Requests', 429),
      );
      await request(app.getHttpServer())
        .post('/api/v1/share/discard')
        .send(validBody)
        .expect(429);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.discardShared.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .post('/api/v1/share/discard')
        .send(validBody)
        .expect(502);
    });

    it('returns 503 when the service throws ServiceUnavailableException', async () => {
      service.discardShared.mockRejectedValue(
        new ServiceUnavailableException(),
      );
      await request(app.getHttpServer())
        .post('/api/v1/share/discard')
        .send(validBody)
        .expect(503);
    });
  });
});
