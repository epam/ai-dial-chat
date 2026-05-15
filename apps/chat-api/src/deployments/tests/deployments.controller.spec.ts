import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeploymentsController } from '../deployments.controller';
import { DeploymentsService } from '../deployments.service';

describe('DeploymentsController', () => {
  let controller: DeploymentsController;
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

    controller = module.get(DeploymentsController);
  });

  afterEach(() => vi.clearAllMocks());

  it('getDeployments returns service result', async () => {
    const deployments = [{ name: 'gpt-4' }];
    service.getDeployments.mockResolvedValue(deployments);

    const result = await controller.getDeployments();
    expect(result).toEqual(deployments);
  });

  it('getDeployment delegates to service', async () => {
    const deployment = { name: 'gpt-4' };
    service.getDeployment.mockResolvedValue(deployment);

    const result = await controller.getDeployment('gpt-4');
    expect(result).toEqual(deployment);
    expect(service.getDeployment).toHaveBeenCalledWith('gpt-4');
  });

  it('getDeployment propagates NotFoundException', async () => {
    service.getDeployment.mockRejectedValue(new NotFoundException());
    await expect(controller.getDeployment('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
