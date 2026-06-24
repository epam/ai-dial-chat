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
import { DeploymentsController } from '../deployments.controller';
import { DeploymentsService } from '../deployments.service';
import type { DeploymentsResponseDto } from '../dto/deployment-item.dto';

const mockResponse: DeploymentsResponseDto = {
  deployments: [
    {
      id: 'gpt-4o',
      displayName: 'GPT-4o',
      type: 'model',
      interfaces: ['chat'],
    },
    { id: 'my-app', displayName: 'My App', type: 'application' },
  ],
};

const TEST_USER = {
  sub: 'user-123',
  at: 'test-access-token',
  bucket: 'test-bucket',
};

async function buildApp(service: unknown): Promise<INestApplication> {
  const injectUser = true;
  const module: TestingModule = await Test.createTestingModule({
    controllers: [DeploymentsController],
    providers: [{ provide: DeploymentsService, useValue: service }],
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

describe('DeploymentsController (integration)', () => {
  let app: INestApplication;
  let service: { listDeployments: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = {
      listDeployments: vi.fn().mockResolvedValue(mockResponse),
      getDeploymentConfiguration: vi.fn(),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/deployments', () => {
    it('returns 200 without filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/deployments')
        .expect(200);

      expect(res.body).toEqual(mockResponse);
      expect(service.listDeployments).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        TEST_USER.bucket,
        undefined,
      );
    });

    it('includes new owner and isMy fields when service returns them', async () => {
      const enrichedResponse: DeploymentsResponseDto = {
        deployments: [
          {
            id: 'my-app',
            displayName: 'My App',
            type: 'application',
            owner: 'users/alice@example.com',
            isMy: true,
          },
        ],
      };
      service.listDeployments.mockResolvedValue(enrichedResponse);

      const res = await request(app.getHttpServer())
        .get('/api/v1/deployments')
        .expect(200);

      expect(res.body.deployments[0].owner).toBe('users/alice@example.com');
      expect(res.body.deployments[0].isMy).toBe(true);
    });

    it('includes applicationFolder when service returns it for a nested application', async () => {
      const enrichedResponse: DeploymentsResponseDto = {
        deployments: [
          {
            id: 'folder1/my-app',
            displayName: 'My App',
            type: 'application',
            applicationFolder: 'folder1',
          },
        ],
      };
      service.listDeployments.mockResolvedValue(enrichedResponse);

      const res = await request(app.getHttpServer())
        .get('/api/v1/deployments')
        .expect(200);

      expect(res.body.deployments[0].applicationFolder).toBe('folder1');
    });

    it('returns 200 with ?interface_type=chat', async () => {
      const chatResponse: DeploymentsResponseDto = {
        deployments: [
          {
            id: 'gpt-4o',
            displayName: 'GPT-4o',
            type: 'model',
            interfaces: ['chat'],
          },
        ],
      };
      service.listDeployments.mockResolvedValue(chatResponse);

      const res = await request(app.getHttpServer())
        .get('/api/v1/deployments?interface_type=chat')
        .expect(200);

      expect(res.body).toEqual(chatResponse);
      expect(service.listDeployments).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        TEST_USER.bucket,
        ['chat'],
      );
    });

    it('returns 400 with invalid interface_type', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/deployments?interface_type=unknown')
        .expect(400);
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.listDeployments.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer()).get('/api/v1/deployments').expect(401);
    });

    it('returns 502 when service throws BadGatewayException', async () => {
      service.listDeployments.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer()).get('/api/v1/deployments').expect(502);
    });

    it('returns 503 when service throws ServiceUnavailableException', async () => {
      service.listDeployments.mockRejectedValue(
        new ServiceUnavailableException(),
      );
      await request(app.getHttpServer()).get('/api/v1/deployments').expect(503);
    });
  });

  describe('GET /deployments/:deployment/configuration', () => {
    it('returns 200 with JSON Schema object', async () => {
      const schema = {
        type: 'object',
        title: 'StatGPT Config',
        properties: {},
      };
      service.getDeploymentConfiguration.mockResolvedValue(schema);

      const response = await request(app.getHttpServer())
        .get('/api/v1/deployments/statgpt/configuration')
        .expect(200);
      expect(response.body).toEqual(schema);
      expect(service.getDeploymentConfiguration).toHaveBeenCalledWith(
        'statgpt',
        TEST_USER.sub,
        TEST_USER.at,
      );
    });

    it('returns 404 when deployment does not support configuration', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      service.getDeploymentConfiguration.mockRejectedValue(
        new NotFoundException(),
      );

      await request(app.getHttpServer())
        .get('/api/v1/deployments/basic-model/configuration')
        .expect(404);
    });

    it('returns 503 when DIAL Core is unreachable', async () => {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      service.getDeploymentConfiguration.mockRejectedValue(
        new ServiceUnavailableException(),
      );

      await request(app.getHttpServer())
        .get('/api/v1/deployments/statgpt/configuration')
        .expect(503);
    });
  });
});
