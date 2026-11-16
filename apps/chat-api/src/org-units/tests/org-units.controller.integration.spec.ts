import {
  BadGatewayException,
  type CanActivate,
  ForbiddenException,
  INestApplication,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { OrgUnitsController } from '../org-units.controller';
import { OrgUnitsService } from '../org-units.service';

const TEST_USER = { sub: 'user-123', at: 'test-access-token' };

const UNITS_BODY = {
  enabled: true,
  units: [
    {
      id: 'u-acme',
      name: 'Acme',
      displayName: 'Acme Corp',
      path: 'public/Acme',
      folder: 'public/Acme/',
    },
  ],
};

/** Stands in for the global session guard rejecting a call with no session. */
class RejectingSessionGuard implements CanActivate {
  canActivate(): boolean {
    throw new UnauthorizedException();
  }
}

const buildApp = async (
  service: { listOrgUnits: ReturnType<typeof vi.fn> },
  { hasSession = true, isFeatureEnabled = true } = {},
): Promise<INestApplication> => {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [OrgUnitsController],
    providers: [
      { provide: OrgUnitsService, useValue: service },
      ...(hasSession
        ? []
        : [{ provide: APP_GUARD, useClass: RejectingSessionGuard }]),
    ],
  })
    .overrideGuard(FeatureGuard)
    .useValue({
      canActivate: () => {
        if (!isFeatureEnabled) {
          throw new ForbiddenException();
        }
        return true;
      },
    })
    .compile();

  const app = module.createNestApplication();
  app.use(
    (
      req: Express.Request & { user?: unknown },
      _res: unknown,
      next: () => void,
    ) => {
      if (hasSession) req.user = TEST_USER;
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
  return app;
};

describe('OrgUnitsController (integration)', () => {
  let app: INestApplication | undefined;
  const service = { listOrgUnits: vi.fn() };

  afterEach(async () => {
    vi.clearAllMocks();
    await app?.close();
    app = undefined;
  });

  describe('GET /api/v1/org-units', () => {
    it('returns the units for the session user', async () => {
      service.listOrgUnits.mockResolvedValue(UNITS_BODY);
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .get('/api/v1/org-units')
        .expect(200);

      expect(res.body).toEqual(UNITS_BODY);
      expect(service.listOrgUnits).toHaveBeenCalledWith(
        'user-123',
        'test-access-token',
      );
    });

    it('returns 200 with enabled: false when org units are off in Core', async () => {
      service.listOrgUnits.mockResolvedValue({ enabled: false, units: [] });
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .get('/api/v1/org-units')
        .expect(200);

      expect(res.body).toEqual({ enabled: false, units: [] });
    });

    it('returns 401 without a session and never reads the units', async () => {
      app = await buildApp(service, { hasSession: false });

      await request(app.getHttpServer()).get('/api/v1/org-units').expect(401);

      expect(service.listOrgUnits).not.toHaveBeenCalled();
    });

    it('returns 403 and never reads the units while the orgUnitsEnabled flag is off', async () => {
      app = await buildApp(service, { isFeatureEnabled: false });

      await request(app.getHttpServer()).get('/api/v1/org-units').expect(403);

      expect(service.listOrgUnits).not.toHaveBeenCalled();
    });

    it('returns 502 when DIAL Core returns an error response', async () => {
      service.listOrgUnits.mockRejectedValue(new BadGatewayException());
      app = await buildApp(service);

      await request(app.getHttpServer()).get('/api/v1/org-units').expect(502);
    });

    it('returns 503 when DIAL Core is unreachable', async () => {
      service.listOrgUnits.mockRejectedValue(new ServiceUnavailableException());
      app = await buildApp(service);

      await request(app.getHttpServer()).get('/api/v1/org-units').expect(503);
    });
  });
});
