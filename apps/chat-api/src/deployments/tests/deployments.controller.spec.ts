import { NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { DeploymentsController } from '../deployments.controller';
import type { DeploymentsService } from '../deployments.service';
import {
  DeploymentInterfaceType,
  type DeploymentsQueryDto,
} from '../dto/deployments-query.dto';

const TEST_USER = {
  sub: 'user-123',
  at: 'test-access-token',
  bucket: 'test-bucket',
};
const mockReq = { user: TEST_USER } as unknown as Request;

function makeController() {
  const service = {
    listDeployments: vi.fn().mockResolvedValue({ deployments: [] }),
    getDeploymentConfiguration: vi.fn(),
    getDeploymentLimits: vi.fn(),
    getDeploymentDetails: vi.fn(),
  } as unknown as DeploymentsService;

  const controller = new DeploymentsController(service);
  return { controller, service };
}

describe('DeploymentsController', () => {
  it('delegates to service with parsed query and extracts sub and at from request', async () => {
    const { controller, service } = makeController();
    const query: DeploymentsQueryDto = {
      interface_type: [DeploymentInterfaceType.Chat],
    };

    await controller.listDeployments(query, mockReq);

    expect(service.listDeployments).toHaveBeenCalledWith(
      TEST_USER.sub,
      TEST_USER.at,
      TEST_USER.bucket,
      [DeploymentInterfaceType.Chat],
    );
  });

  it('passes undefined interface_type when query has no filter', async () => {
    const { controller, service } = makeController();
    const query: DeploymentsQueryDto = {};

    await controller.listDeployments(query, mockReq);

    expect(service.listDeployments).toHaveBeenCalledWith(
      TEST_USER.sub,
      TEST_USER.at,
      TEST_USER.bucket,
      undefined,
    );
  });

  it('getDeploymentConfiguration returns service result', async () => {
    const { controller, service } = makeController();
    const schema = { type: 'object', title: 'Config' };
    (
      service.getDeploymentConfiguration as ReturnType<typeof vi.fn>
    ).mockResolvedValue(schema);

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
    const { controller, service } = makeController();
    (
      service.getDeploymentConfiguration as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new NotFoundException());
    await expect(
      controller.getDeploymentConfiguration(mockReq, 'unknown'),
    ).rejects.toThrow(NotFoundException);
  });

  it('getDeploymentLimits returns service result', async () => {
    const { controller, service } = makeController();
    const limits = { dayTokenStats: { total: 100, used: 10 } };
    (service.getDeploymentLimits as ReturnType<typeof vi.fn>).mockResolvedValue(
      limits,
    );

    const result = await controller.getDeploymentLimits(mockReq, 'gpt-4o');
    expect(result).toEqual(limits);
    expect(service.getDeploymentLimits).toHaveBeenCalledWith(
      'gpt-4o',
      TEST_USER.at,
    );
  });

  it('getDeploymentLimits propagates NotFoundException', async () => {
    const { controller, service } = makeController();
    (service.getDeploymentLimits as ReturnType<typeof vi.fn>).mockRejectedValue(
      new NotFoundException(),
    );
    await expect(
      controller.getDeploymentLimits(mockReq, 'unknown'),
    ).rejects.toThrow(NotFoundException);
  });

  it('getDeploymentDetails returns service result', async () => {
    const { controller, service } = makeController();
    const details = { id: 'gpt-4o', type: 'model' as const };
    (
      service.getDeploymentDetails as ReturnType<typeof vi.fn>
    ).mockResolvedValue(details);

    const result = await controller.getDeploymentDetails(mockReq, 'gpt-4o');
    expect(result).toEqual(details);
    expect(service.getDeploymentDetails).toHaveBeenCalledWith(
      TEST_USER.sub,
      'gpt-4o',
      TEST_USER.at,
    );
  });

  it('getDeploymentDetails propagates NotFoundException', async () => {
    const { controller, service } = makeController();
    (
      service.getDeploymentDetails as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new NotFoundException());
    await expect(
      controller.getDeploymentDetails(mockReq, 'unknown'),
    ).rejects.toThrow(NotFoundException);
  });
});
