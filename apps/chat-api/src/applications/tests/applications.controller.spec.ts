import {
  ConflictException,
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
import { ApplicationsController } from '../applications.controller';
import { ApplicationsService } from '../applications.service';
import type { ApplicationsResponseDto } from '../dto/application.dto';

const mockApp = { id: 'my-app', object: 'application', display_name: 'My App' };
const mockList: ApplicationsResponseDto = { data: [mockApp] };
const createdApp = {
  id: 'users/u/applications/new-app',
  displayName: 'New App',
};
const updatedApp = {
  id: 'applications/test-bucket/My%20App__0.0.1',
};

const TEST_USER = { sub: 'user-123', at: 'test-access-token' };

async function buildApp(
  service: unknown,
  injectUser = true,
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ApplicationsController],
    providers: [{ provide: ApplicationsService, useValue: service }],
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

describe('ApplicationsController (integration)', () => {
  let app: INestApplication;
  let service: {
    listApplications: ReturnType<typeof vi.fn>;
    createApplication: ReturnType<typeof vi.fn>;
    updateApplication: ReturnType<typeof vi.fn>;
    deleteApplication: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listApplications: vi.fn().mockResolvedValue(mockList),
      createApplication: vi.fn().mockResolvedValue(createdApp),
      updateApplication: vi.fn().mockResolvedValue(updatedApp),
      deleteApplication: vi.fn().mockResolvedValue(undefined),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/applications', () => {
    it('returns 200 with { data: [...] } for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/applications')
        .expect(200);

      expect(res.body).toEqual(mockList);
      expect(service.listApplications).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
      );
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.listApplications.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .get('/api/v1/applications')
        .expect(401);
    });

    it('returns 503 when service throws ServiceUnavailableException', async () => {
      service.listApplications.mockRejectedValue(
        new ServiceUnavailableException(),
      );
      await request(app.getHttpServer())
        .get('/api/v1/applications')
        .expect(503);
    });
  });

  describe('POST /api/v1/applications', () => {
    const validBody = {
      name: 'New App',
      type: 'https://mydial.epam.com/custom_application_schemas/quickapps2',
    };

    it('returns 201 with created application on success', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .send(validBody)
        .expect(201);

      expect(res.body).toEqual(createdApp);
      expect(service.createApplication).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        validBody,
      );
    });

    it('returns 400 when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .send({ type: 'https://mydial.epam.com/schema' })
        .expect(400);

      expect(service.createApplication).not.toHaveBeenCalled();
    });

    it('returns 201 when type is omitted (custom app with no schema)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .send({ name: 'My App' })
        .expect(201);

      expect(service.createApplication).toHaveBeenCalled();
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.createApplication.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .send(validBody)
        .expect(401);
    });

    it('returns 400 when unknown fields are sent (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .send({ ...validBody, unknown_field: 'value' })
        .expect(400);

      expect(service.createApplication).not.toHaveBeenCalled();
    });

    it('returns 409 when service throws ConflictException', async () => {
      service.createApplication.mockRejectedValue(new ConflictException());
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .send(validBody)
        .expect(409);
    });

    it('returns 503 when service throws ServiceUnavailableException', async () => {
      service.createApplication.mockRejectedValue(
        new ServiceUnavailableException(),
      );
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .send(validBody)
        .expect(503);
    });
  });

  describe('PATCH /api/v1/applications/:applicationName', () => {
    const validBody = { name: 'Updated App' };

    it('returns 200 with the updated application on success', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/applications/my-app')
        .send(validBody)
        .expect(200);

      expect(res.body).toEqual(updatedApp);
      expect(service.updateApplication).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'my-app',
        validBody,
      );
    });

    it('returns 400 when name is missing', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/applications/my-app')
        .send({ description: 'no name' })
        .expect(400);

      expect(service.updateApplication).not.toHaveBeenCalled();
    });

    it('returns 400 when the request body still includes an intro property', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/applications/my-app')
        .send({ ...validBody, intro: 'Short intro' })
        .expect(400);

      expect(service.updateApplication).not.toHaveBeenCalled();
    });

    it('returns 400 for an application name with invalid characters', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/applications/bad;name')
        .send(validBody)
        .expect(400);

      expect(service.updateApplication).not.toHaveBeenCalled();
    });

    it('returns 400 when unknown fields are sent (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/applications/my-app')
        .send({ ...validBody, type: 'https://mydial.epam.com/schema' })
        .expect(400);

      expect(service.updateApplication).not.toHaveBeenCalled();
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.updateApplication.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .patch('/api/v1/applications/my-app')
        .send(validBody)
        .expect(401);
    });

    it('returns 404 when service throws NotFoundException', async () => {
      service.updateApplication.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .patch('/api/v1/applications/my-app')
        .send(validBody)
        .expect(404);
    });

    it('returns 503 when service throws ServiceUnavailableException', async () => {
      service.updateApplication.mockRejectedValue(
        new ServiceUnavailableException(),
      );
      await request(app.getHttpServer())
        .patch('/api/v1/applications/my-app')
        .send(validBody)
        .expect(503);
    });
  });

  describe('DELETE /api/v1/applications/:applicationName', () => {
    it('returns 204 on success', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/applications/my-app')
        .expect(204);
      expect(service.deleteApplication).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'my-app',
      );
    });

    it('returns 400 for an application name with invalid characters', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/applications/bad;name')
        .expect(400);
      expect(service.deleteApplication).not.toHaveBeenCalled();
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.deleteApplication.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .delete('/api/v1/applications/my-app')
        .expect(401);
    });

    it('returns 503 when service throws ServiceUnavailableException', async () => {
      service.deleteApplication.mockRejectedValue(
        new ServiceUnavailableException(),
      );
      await request(app.getHttpServer())
        .delete('/api/v1/applications/my-app')
        .expect(503);
    });
  });
});
