import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { OrgUnitsController } from '../org-units.controller';
import type { OrgUnitsService } from '../org-units.service';

describe('OrgUnitsController', () => {
  it("lists the org units with the session user's id and token", async () => {
    const body = { enabled: true, units: [] };
    const service = {
      listOrgUnits: vi.fn().mockResolvedValue(body),
    } as unknown as OrgUnitsService;
    const controller = new OrgUnitsController(service);

    const result = await controller.listOrgUnits({
      user: { sub: 'user-1', at: 'token-1' },
    } as unknown as Request);

    expect(result).toBe(body);
    expect(service.listOrgUnits).toHaveBeenCalledWith('user-1', 'token-1');
  });
});
