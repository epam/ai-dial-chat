import { afterEach, describe, expect, it, vi } from 'vitest';
import { orgUnitsApi } from '../api-client';
import { listOrgUnits } from '../org-units.api';

describe('org-units server-api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listOrgUnits', () => {
    it('delegates to the generated listOrgUnits method and returns hasAdminAccess and permissions', async () => {
      const mockResponse = {
        enabled: true,
        hasAdminAccess: false,
        units: [
          {
            id: 'u-acme',
            name: 'Acme',
            displayName: 'Acme Corp',
            path: 'public/Acme',
            folder: 'public/Acme/',
            permissions: { applications: ['read', 'write'] },
          },
        ],
      };
      const spy = vi
        .spyOn(orgUnitsApi, 'listOrgUnits')
        .mockResolvedValue(mockResponse);

      const result = await listOrgUnits();

      expect(spy).toHaveBeenCalledOnce();
      expect(result).toBe(mockResponse);
      expect(result.hasAdminAccess).toBe(false);
      expect(result.units[0].permissions).toEqual({
        applications: ['read', 'write'],
      });
    });
  });
});
