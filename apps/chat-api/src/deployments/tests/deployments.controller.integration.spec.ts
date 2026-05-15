import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeploymentsController } from '../deployments.controller';
import { DeploymentsService } from '../deployments.service';

describe('DeploymentsController (integration)', () => {
  let app: INestApplication;
  let service: {
    getDeployments: ReturnType<typeof vi.fn>;
    getDeployment: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      getDeployments: vi.fn(),
      getDeployment: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeploymentsController],
      providers: [{ provide: DeploymentsService, useValue: service }],
    }).compile();

    app = module.createNestApplication();
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

  describe('GET /deployments', () => {
    it('returns 200 with deployment array', async () => {
      const deployments = [{ name: 'gpt-4' }, { name: 'gpt-3.5-turbo' }];
      service.getDeployments.mockResolvedValue(deployments);

      const response = await request(app.getHttpServer())
        .get('/deployments')
        .expect(200);
      expect(response.body).toEqual(deployments);
    });

    it('returns 503 when SDK throws network error', async () => {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      service.getDeployments.mockRejectedValue(
        new ServiceUnavailableException(),
      );

      await request(app.getHttpServer()).get('/deployments').expect(503);
    });
  });

  describe('GET /deployments/:deployment', () => {
    it('returns 200 with deployment object', async () => {
      const deployment = { name: 'gpt-4', description: 'GPT-4 model' };
      service.getDeployment.mockResolvedValue(deployment);

      const response = await request(app.getHttpServer())
        .get('/deployments/gpt-4')
        .expect(200);
      expect(response.body).toEqual(deployment);
      expect(service.getDeployment).toHaveBeenCalledWith('gpt-4');
    });

    it('returns 404 for unknown deployment', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      service.getDeployment.mockRejectedValue(new NotFoundException());

      await request(app.getHttpServer())
        .get('/deployments/unknown')
        .expect(404);
    });
  });
});
