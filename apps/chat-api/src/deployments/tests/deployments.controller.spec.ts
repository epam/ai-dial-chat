import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DeploymentsController } from '../deployments.controller';
import type { DeploymentsService } from '../deployments.service';
import type { DeploymentsQueryDto } from '../dto/deployments-query.dto';

const TEST_USER = { sub: 'user-123', at: 'test-access-token' };
const mockReq = { user: TEST_USER } as unknown as Request;

function makeController() {
  const service = {
    listDeployments: vi.fn().mockResolvedValue({ deployments: [] }),
    getDeploymentConfiguration: vi.fn(),
  } as unknown as DeploymentsService;

  const controller = new DeploymentsController(service);
  return { controller, service };
}

describe('DeploymentsController', () => {
  it('delegates to service with parsed query and extracts sub and at from request', async () => {
    const { controller, service } = makeController();
    const query: DeploymentsQueryDto = { interface_type: ['chat'] };
    const req = { user: TEST_USER } as never;

    await controller.listDeployments(query, req);

    expect(service.listDeployments).toHaveBeenCalledWith(
      TEST_USER.sub,
      TEST_USER.at,
      ['chat'],
    );
  });

  it('passes undefined interface_type when query has no filter', async () => {
    const { controller, service } = makeController();
    const query: DeploymentsQueryDto = {};
    const req = { user: TEST_USER } as never;

    await controller.listDeployments(query, req);

    expect(service.listDeployments).toHaveBeenCalledWith(
      TEST_USER.sub,
      TEST_USER.at,
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
});
