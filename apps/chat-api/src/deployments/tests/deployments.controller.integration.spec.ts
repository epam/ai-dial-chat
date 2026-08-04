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
  let service: {
    listDeployments: ReturnType<typeof vi.fn>;
    getDeploymentConfiguration: ReturnType<typeof vi.fn>;
    getDeploymentLimits: ReturnType<typeof vi.fn>;
    getDeploymentDetails: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listDeployments: vi.fn().mockResolvedValue(mockResponse),
      getDeploymentConfiguration: vi.fn(),
      getDeploymentLimits: vi.fn(),
      getDeploymentDetails: vi.fn(),
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
      expect(res.headers['cache-control']).toBe('private, max-age=30');
      expect(service.listDeployments).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        TEST_USER.bucket,
        undefined,
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

    it('includes sharedWithMe field when service returns it', async () => {
      const enrichedResponse: DeploymentsResponseDto = {
        deployments: [
          {
            id: 'applications/other-bucket/their-app',
            displayName: 'Their App',
            type: 'application',
            isMy: false,
            sharedWithMe: true,
          },
        ],
      };
      service.listDeployments.mockResolvedValue(enrichedResponse);

      const res = await request(app.getHttpServer())
        .get('/api/v1/deployments')
        .expect(200);

      expect(res.body.deployments[0].sharedWithMe).toBe(true);
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
        undefined,
      );
    });

    it('passes refresh=true to service', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/deployments?refresh=true')
        .expect(200);

      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(service.listDeployments).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        TEST_USER.bucket,
        undefined,
        true,
      );
    });

    it('returns 400 for invalid refresh value', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/deployments?refresh=maybe')
        .expect(400);
    });

    it('returns 400 with invalid interface_type', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/deployments?interface_type=unknown')
        .expect(400);
    });

    it('returns 400 for old embeddings value', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/deployments?interface_type=embeddings')
        .expect(400);
    });

    it('returns 200 for corrected embedding value', async () => {
      const embeddingResponse: DeploymentsResponseDto = {
        deployments: [
          { id: 'embed-model', displayName: 'Embed', type: 'model' },
        ],
      };
      service.listDeployments.mockResolvedValue(embeddingResponse);

      await request(app.getHttpServer())
        .get('/api/v1/deployments?interface_type=embedding')
        .expect(200);

      expect(service.listDeployments).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        TEST_USER.bucket,
        ['embedding'],
        undefined,
      );
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

  describe('deployment path parameter validation', () => {
    it.each([
      ['configuration', 'getDeploymentConfiguration'],
      ['limits', 'getDeploymentLimits'],
      ['details', 'getDeploymentDetails'],
    ] as const)(
      'returns 400 for traversal before calling the %s service',
      async (suffix, serviceMethod) => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/deployments/..%2Fetc%2Fpasswd/${suffix}`)
          .expect(400);

        expect(response.body.message).toContain(
          'deployment must not contain empty, dot, dot-dot, or control-character path segments',
        );
        expect(service[serviceMethod]).not.toHaveBeenCalled();
      },
    );

    it('returns 400 for an empty decoded path segment', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/deployments/applications%2F%2Fname/limits')
        .expect(400);

      expect(service.getDeploymentLimits).not.toHaveBeenCalled();
    });

    it('returns 400 for a deployment identifier longer than 2048 characters', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/deployments/${'a'.repeat(2049)}/limits`)
        .expect(400);

      expect(service.getDeploymentLimits).not.toHaveBeenCalled();
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

  describe('GET /api/v1/deployments/:deployment/limits', () => {
    const mockLimits = {
      dayTokenStats: { total: 10000, used: 4000 },
    };

    it('returns 200 with deployment limits', async () => {
      service.getDeploymentLimits.mockResolvedValue(mockLimits);

      const res = await request(app.getHttpServer())
        .get('/api/v1/deployments/gpt-4o/limits')
        .expect(200);

      expect(res.body).toEqual(mockLimits);
      expect(service.getDeploymentLimits).toHaveBeenCalledWith(
        'gpt-4o',
        TEST_USER.at,
      );
    });

    it('accepts percent-encoded deployment names in a single path segment', async () => {
      service.getDeploymentLimits.mockResolvedValue(mockLimits);

      await request(app.getHttpServer())
        .get('/api/v1/deployments/applications%2Ffoo%2Fbar/limits')
        .expect(200);

      expect(service.getDeploymentLimits).toHaveBeenCalledWith(
        'applications/foo/bar',
        TEST_USER.at,
      );
    });

    it('accepts encoded spaces and reserved characters in a deployment name', async () => {
      service.getDeploymentLimits.mockResolvedValue(mockLimits);

      await request(app.getHttpServer())
        .get(
          '/api/v1/deployments/applications%2Fbucket%2FMy%20App%20%231%2A/limits',
        )
        .expect(200);

      expect(service.getDeploymentLimits).toHaveBeenCalledWith(
        'applications/bucket/My App #1*',
        TEST_USER.at,
      );
    });

    it('returns 404 when limits not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      service.getDeploymentLimits.mockRejectedValue(new NotFoundException());

      await request(app.getHttpServer())
        .get('/api/v1/deployments/unknown/limits')
        .expect(404);
    });

    it('returns 503 when DIAL Core is unreachable', async () => {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      service.getDeploymentLimits.mockRejectedValue(
        new ServiceUnavailableException(),
      );

      await request(app.getHttpServer())
        .get('/api/v1/deployments/gpt-4o/limits')
        .expect(503);
    });
  });

  describe('GET /api/v1/deployments/:deployment/details', () => {
    const mockDetails = {
      id: 'gpt-4o',
      type: 'model',
      modelDetails: { lifecycleStatus: 'generally-available' },
    };

    it('returns 200 with deployment details', async () => {
      service.getDeploymentDetails.mockResolvedValue(mockDetails);

      const res = await request(app.getHttpServer())
        .get('/api/v1/deployments/gpt-4o/details')
        .expect(200);

      expect(res.body).toEqual(mockDetails);
      expect(service.getDeploymentDetails).toHaveBeenCalledWith(
        TEST_USER.sub,
        'gpt-4o',
        TEST_USER.at,
      );
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.getDeploymentDetails.mockRejectedValue(
        new UnauthorizedException(),
      );

      await request(app.getHttpServer())
        .get('/api/v1/deployments/gpt-4o/details')
        .expect(401);
    });

    it('returns 404 when deployment is not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      service.getDeploymentDetails.mockRejectedValue(new NotFoundException());

      await request(app.getHttpServer())
        .get('/api/v1/deployments/unknown/details')
        .expect(404);
    });

    it('returns 502 when DIAL Core returns an error response', async () => {
      service.getDeploymentDetails.mockRejectedValue(new BadGatewayException());

      await request(app.getHttpServer())
        .get('/api/v1/deployments/gpt-4o/details')
        .expect(502);
    });

    it('returns 503 when DIAL Core is unreachable', async () => {
      service.getDeploymentDetails.mockRejectedValue(
        new ServiceUnavailableException(),
      );

      await request(app.getHttpServer())
        .get('/api/v1/deployments/gpt-4o/details')
        .expect(503);
    });
  });
});
