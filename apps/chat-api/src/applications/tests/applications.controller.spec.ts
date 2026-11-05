import {
  ConflictException,
  ForbiddenException,
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
  await app.listen(0, '127.0.0.1');
  return app;
}

describe('ApplicationsController (integration)', () => {
  let app: INestApplication;
  let service: {
    listApplications: ReturnType<typeof vi.fn>;
    createApplication: ReturnType<typeof vi.fn>;
    updateApplication: ReturnType<typeof vi.fn>;
    deleteApplication: ReturnType<typeof vi.fn>;
    listApplicationFolders: ReturnType<typeof vi.fn>;
    moveApplication: ReturnType<typeof vi.fn>;
    forkApplicationVersion: ReturnType<typeof vi.fn>;
    commitApplicationVersion: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listApplications: vi.fn().mockResolvedValue(mockList),
      createApplication: vi.fn().mockResolvedValue(createdApp),
      updateApplication: vi.fn().mockResolvedValue(updatedApp),
      deleteApplication: vi.fn().mockResolvedValue(undefined),
      listApplicationFolders: vi
        .fn()
        .mockResolvedValue({ folders: [{ name: 'Design', path: 'Design' }] }),
      moveApplication: vi
        .fn()
        .mockResolvedValue({ id: 'applications/b1/Design/agent__1.0.0' }),
      forkApplicationVersion: vi
        .fn()
        .mockResolvedValue({ id: 'applications/b1/agent__1.1.0' }),
      commitApplicationVersion: vi
        .fn()
        .mockResolvedValue({ id: 'applications/b1/agent__1.1.0' }),
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

    it('accepts template settings and create-only options through validation', async () => {
      const body = {
        ...validBody,
        createOnly: true,
        preserveApplicationProperties: true,
        applicationProperties: {
          features: { timestamp: null },
          custom: { enabled: true },
        },
        inputAttachmentTypes: ['image/png'],
        maxInputAttachments: 3,
      };
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .send(body)
        .expect(201);
      expect(service.createApplication).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        body,
      );
    });

    it.each([
      { createOnly: 'true' },
      { preserveApplicationProperties: 'true' },
      { inputAttachmentTypes: ['invalid'] },
      { maxInputAttachments: -1 },
    ])('rejects malformed create options: %j', async (options) => {
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .send({ ...validBody, ...options })
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

    it('forwards an empty iconUrl to the service as an explicit clear', async () => {
      const clearBody = { ...validBody, iconUrl: '' };

      await request(app.getHttpServer())
        .patch('/api/v1/applications/my-app')
        .send(clearBody)
        .expect(200);

      expect(service.updateApplication).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'my-app',
        clearBody,
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

    it('forwards applicationProperties to the service unchanged', async () => {
      const bodyWithProperties = {
        ...validBody,
        applicationProperties: {
          orchestrator: { system_prompt: { type: 'custom' } },
          tool_sets: [],
        },
      };

      await request(app.getHttpServer())
        .patch('/api/v1/applications/my-app')
        .send(bodyWithProperties)
        .expect(200);

      expect(service.updateApplication).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'my-app',
        bodyWithProperties,
      );
    });

    it('returns 400 when applicationProperties is not an object', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/applications/my-app')
        .send({ ...validBody, applicationProperties: 'not-an-object' })
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

  describe('GET /api/v1/applications/folders', () => {
    it('returns the folders under the requested path', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/applications/folders')
        .query({ path: 'Design' })
        .expect(200);
      expect(res.body).toEqual({
        folders: [{ name: 'Design', path: 'Design' }],
      });
      expect(service.listApplicationFolders).toHaveBeenCalledWith(
        TEST_USER.at,
        'Design',
      );
    });

    it('lists the root when path is omitted', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/applications/folders')
        .expect(200);
      expect(service.listApplicationFolders).toHaveBeenCalledWith(
        TEST_USER.at,
        '',
      );
    });

    it('returns 400 for a traversal path without calling the service', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/applications/folders')
        .query({ path: '../other' })
        .expect(400);
      expect(service.listApplicationFolders).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/applications/:applicationName/move', () => {
    it('returns 200 with the new id', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/applications/applications%2Fb1%2Fagent__1.0.0/move')
        .send({ folderPath: 'Design' })
        .expect(200);
      expect(res.body).toEqual({ id: 'applications/b1/Design/agent__1.0.0' });
      expect(service.moveApplication).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'applications/b1/agent__1.0.0',
        'Design',
      );
    });

    it.each(['../escape', 'trailing/', 'a//b'])(
      'returns 400 for the folder path %j',
      async (folderPath) => {
        await request(app.getHttpServer())
          .post('/api/v1/applications/my-app/move')
          .send({ folderPath })
          .expect(400);
        expect(service.moveApplication).not.toHaveBeenCalled();
      },
    );

    it('returns 409 when the target exists', async () => {
      service.moveApplication.mockRejectedValue(new ConflictException());
      await request(app.getHttpServer())
        .post('/api/v1/applications/my-app/move')
        .send({ folderPath: 'Design' })
        .expect(409);
    });

    it('returns 403 when the application belongs to another user', async () => {
      service.moveApplication.mockRejectedValue(new ForbiddenException());
      await request(app.getHttpServer())
        .post('/api/v1/applications/my-app/move')
        .send({ folderPath: '' })
        .expect(403);
    });
  });

  describe('POST /api/v1/applications/:applicationName/versions', () => {
    it('returns 201 with the snapshot id', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/applications/my-app/versions')
        .send({ version: '1.1.0', folderPath: '' })
        .expect(201);
      expect(res.body).toEqual({ id: 'applications/b1/agent__1.1.0' });
      expect(service.forkApplicationVersion).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'my-app',
        { version: '1.1.0', folderPath: '' },
      );
    });

    it('returns 400 for a version with forbidden characters', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/applications/my-app/versions')
        .send({ version: '1.1/../x', folderPath: '' })
        .expect(400);
      expect(service.forkApplicationVersion).not.toHaveBeenCalled();
    });

    it('returns 409 when the version exists', async () => {
      service.forkApplicationVersion.mockRejectedValue(new ConflictException());
      await request(app.getHttpServer())
        .post('/api/v1/applications/my-app/versions')
        .send({ version: '1.1.0', folderPath: '' })
        .expect(409);
    });
  });

  describe('POST /api/v1/applications/:applicationName/versions/commit', () => {
    it('returns 200 with the new version id', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/applications/my-app/versions/commit')
        .send({ snapshotId: 'applications/b1/agent__1.1.0' })
        .expect(200);
      expect(res.body).toEqual({ id: 'applications/b1/agent__1.1.0' });
      expect(service.commitApplicationVersion).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'my-app',
        { snapshotId: 'applications/b1/agent__1.1.0' },
      );
    });

    it.each(['toolsets/b1/x', 'applications/b1/../x', ''])(
      'returns 400 for the snapshot id %j',
      async (snapshotId) => {
        await request(app.getHttpServer())
          .post('/api/v1/applications/my-app/versions/commit')
          .send({ snapshotId })
          .expect(400);
        expect(service.commitApplicationVersion).not.toHaveBeenCalled();
      },
    );

    it('returns 409 when a resource changed during commit', async () => {
      service.commitApplicationVersion.mockRejectedValue(
        new ConflictException(),
      );
      await request(app.getHttpServer())
        .post('/api/v1/applications/my-app/versions/commit')
        .send({ snapshotId: 'applications/b1/agent__1.1.0' })
        .expect(409);
    });
  });
});
