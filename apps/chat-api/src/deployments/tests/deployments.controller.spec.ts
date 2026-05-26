import { describe, expect, it, vi } from 'vitest';
import { DeploymentsController } from '../deployments.controller';
import type { DeploymentsService } from '../deployments.service';
import type { DeploymentsQueryDto } from '../dto/deployments-query.dto';

const TEST_USER = { sub: 'user-123', at: 'test-access-token' };

function makeController() {
  const service = {
    listDeployments: vi.fn().mockResolvedValue({ deployments: [] }),
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
});
