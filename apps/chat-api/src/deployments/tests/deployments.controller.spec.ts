import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeploymentsController } from '../deployments.controller';
import { DeploymentsService } from '../deployments.service';

const TEST_USER = { at: 'test-access-token', sub: 'user-123' };
const mockReq = { user: TEST_USER } as unknown as Request;

describe('DeploymentsController', () => {
  let controller: DeploymentsController;
  let service: {
    getDeployments: ReturnType<typeof vi.fn>;
    getDeployment: ReturnType<typeof vi.fn>;
    getDeploymentConfiguration: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      getDeployments: vi.fn(),
      getDeployment: vi.fn(),
      getDeploymentConfiguration: vi.fn(),
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

    const result = await controller.getDeployments(mockReq);
    expect(result).toEqual(deployments);
    expect(service.getDeployments).toHaveBeenCalledWith(TEST_USER.at);
  });

  it('getDeployment delegates to service', async () => {
    const deployment = { name: 'gpt-4' };
    service.getDeployment.mockResolvedValue(deployment);

    const result = await controller.getDeployment(mockReq, 'gpt-4');
    expect(result).toEqual(deployment);
    expect(service.getDeployment).toHaveBeenCalledWith('gpt-4', TEST_USER.at);
  });

  it('getDeployment propagates NotFoundException', async () => {
    service.getDeployment.mockRejectedValue(new NotFoundException());
    await expect(controller.getDeployment(mockReq, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getDeploymentConfiguration returns service result', async () => {
    const schema = { type: 'object', title: 'Config' };
    service.getDeploymentConfiguration.mockResolvedValue(schema);

    const result = await controller.getDeploymentConfiguration(
      mockReq,
      'statgpt',
    );
    expect(result).toEqual(schema);
    expect(service.getDeploymentConfiguration).toHaveBeenCalledWith(
      'statgpt',
      TEST_USER.sub,
      TEST_USER.at,
    );
  });

  it('getDeploymentConfiguration propagates NotFoundException', async () => {
    service.getDeploymentConfiguration.mockRejectedValue(
      new NotFoundException(),
    );
    await expect(
      controller.getDeploymentConfiguration(mockReq, 'unknown'),
    ).rejects.toThrow(NotFoundException);
  });
});
