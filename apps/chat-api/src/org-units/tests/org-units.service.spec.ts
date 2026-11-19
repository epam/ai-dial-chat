import {
  BadGatewayException,
  Logger,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { OrgUnitsService } from '../org-units.service';

const ACME = {
  id: 'u-acme',
  name: 'Acme',
  displayName: 'Acme Corp',
  path: 'public/Acme',
  folder: 'public/Acme/',
  permissions: { applications: ['read', 'write'], prompts: ['read'] },
};
const RISK = {
  id: 'u-risk',
  name: 'US Risk',
  path: 'public/Acme/US Risk',
  folder: 'public/Acme/US%20Risk/',
  roles: [],
};

const ok = (data: unknown) => ({ data, response: {} as Response }) as never;
const err = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

const makeService = () => {
  const getUserRoleAssignments = vi.fn();
  const dialClient = {
    client: { getUserRoleAssignments },
  } as unknown as DialClientService;
  const cache = new Map<string, unknown>();
  const cacheManager = {
    get: vi.fn(async (key: string) => cache.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      cache.set(key, value);
    }),
  };
  const service = new OrgUnitsService(dialClient, cacheManager as never);
  return { service, getUserRoleAssignments, cacheManager };
};

describe('OrgUnitsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns every unit Core shows the caller, flat and in Core order', async () => {
    const { service, getUserRoleAssignments } = makeService();
    getUserRoleAssignments.mockResolvedValue(
      ok({ adminAccess: 'NONE', items: [ACME, RISK] }),
    );

    const result = await service.listOrgUnits('user-1', 'token-1');

    expect(result).toEqual({
      enabled: true,
      hasAdminAccess: false,
      units: [
        ACME,
        {
          id: RISK.id,
          name: RISK.name,
          displayName: 'US Risk',
          path: RISK.path,
          folder: RISK.folder,
          permissions: {},
        },
      ],
    });
    expect(getUserRoleAssignments).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
      }),
    );
  });

  it.each([
    ['FULL', true],
    ['NONE', false],
    [undefined, false],
  ])(
    'maps adminAccess %s to hasAdminAccess %s',
    async (adminAccess, expected) => {
      const { service, getUserRoleAssignments } = makeService();
      getUserRoleAssignments.mockResolvedValue(ok({ adminAccess, items: [] }));

      const result = await service.listOrgUnits('user-1', 'token-1');

      expect(result.hasAdminAccess).toBe(expected);
    },
  );

  it('returns a unit seen only through its parent with empty permissions', async () => {
    const { service, getUserRoleAssignments } = makeService();
    getUserRoleAssignments.mockResolvedValue(ok({ items: [RISK] }));

    const { units } = await service.listOrgUnits('user-1', 'token-1');

    expect(units[0].permissions).toEqual({});
    expect(units[0]).not.toHaveProperty('roles');
  });

  it('falls back to the unit name when Core has no display name', async () => {
    const { service, getUserRoleAssignments } = makeService();
    getUserRoleAssignments.mockResolvedValue(ok({ items: [RISK] }));

    const { units } = await service.listOrgUnits('user-1', 'token-1');

    expect(units[0].displayName).toBe('US Risk');
  });

  it('drops a unit without a folder and keeps the rest', async () => {
    const { service, getUserRoleAssignments } = makeService();
    getUserRoleAssignments.mockResolvedValue(
      ok({ items: [{ ...ACME, folder: undefined }, RISK] }),
    );

    const { units } = await service.listOrgUnits('user-1', 'token-1');

    expect(units.map(({ id }) => id)).toEqual(['u-risk']);
  });

  it('returns an empty list when Core has no items', async () => {
    const { service, getUserRoleAssignments } = makeService();
    getUserRoleAssignments.mockResolvedValue(ok({ adminAccess: 'NONE' }));

    await expect(service.listOrgUnits('user-1', 'token-1')).resolves.toEqual({
      enabled: true,
      hasAdminAccess: false,
      units: [],
    });
  });

  it('reports org units as disabled, and caches that, when Core answers 404', async () => {
    const { service, getUserRoleAssignments, cacheManager } = makeService();
    getUserRoleAssignments.mockResolvedValue(err(404));

    await expect(service.listOrgUnits('user-1', 'token-1')).resolves.toEqual({
      enabled: false,
      hasAdminAccess: false,
      units: [],
    });
    expect(cacheManager.set).toHaveBeenCalledWith(
      'org-units:list:user-1',
      { enabled: false, hasAdminAccess: false, units: [] },
      60_000,
    );
  });

  it.each([
    [401, UnauthorizedException],
    [403, ForbiddenException],
    [500, BadGatewayException],
  ])('maps a Core %i to %p and does not cache it', async (status, type) => {
    const { service, getUserRoleAssignments, cacheManager } = makeService();
    getUserRoleAssignments.mockResolvedValue(err(status));

    await expect(service.listOrgUnits('user-1', 'token-1')).rejects.toThrow(
      type,
    );
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('answers 503 when Core times out', async () => {
    const { service, getUserRoleAssignments } = makeService();
    getUserRoleAssignments.mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );

    await expect(service.listOrgUnits('user-1', 'token-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('serves a second call within the TTL from the cache', async () => {
    const { service, getUserRoleAssignments } = makeService();
    getUserRoleAssignments.mockResolvedValue(ok({ items: [ACME] }));

    await service.listOrgUnits('user-1', 'token-1');
    await service.listOrgUnits('user-1', 'token-1');

    expect(getUserRoleAssignments).toHaveBeenCalledOnce();
  });

  it('keeps a separate cache entry per user', async () => {
    const { service, getUserRoleAssignments, cacheManager } = makeService();
    getUserRoleAssignments.mockResolvedValue(ok({ items: [ACME] }));

    await service.listOrgUnits('user-1', 'token-1');
    await service.listOrgUnits('user-2', 'token-2');

    expect(getUserRoleAssignments).toHaveBeenCalledTimes(2);
    expect(cacheManager.set.mock.calls.map(([key]) => key)).toEqual([
      'org-units:list:user-1',
      'org-units:list:user-2',
    ]);
  });
});

describe('OrgUnitsService.findMissingWriteNamespaces', () => {
  const WRITER = {
    ...ACME,
    permissions: { applications: ['read', 'write'], skills: ['read'] },
  };
  const rights = (data: unknown) => {
    const made = makeService();
    made.getUserRoleAssignments.mockResolvedValue(ok(data));
    return made;
  };
  const check = (service: OrgUnitsService, namespaces: string[]) =>
    service.findMissingWriteNamespaces(
      'user-1',
      'token-1',
      'Acme/Teams',
      namespaces,
    );

  it('returns nothing missing for a writer on every namespace asked', async () => {
    const { service } = rights({ adminAccess: 'NONE', items: [WRITER] });

    await expect(check(service, ['applications'])).resolves.toEqual([]);
  });

  it('names the namespaces the writer lacks, without duplicates', async () => {
    const { service } = rights({ adminAccess: 'NONE', items: [WRITER] });

    await expect(
      check(service, ['applications', 'skills', 'files', 'skills']),
    ).resolves.toEqual(['skills', 'files']);
  });

  it('names every namespace for a reader', async () => {
    const reader = { ...ACME, permissions: { applications: ['read'] } };
    const { service } = rights({ adminAccess: 'NONE', items: [reader] });

    await expect(check(service, ['applications', 'prompts'])).resolves.toEqual([
      'applications',
      'prompts',
    ]);
  });

  it('lets an admin write everywhere inside a unit', async () => {
    const { service } = rights({ adminAccess: 'FULL', items: [WRITER] });

    await expect(check(service, ['applications', 'files'])).resolves.toEqual(
      [],
    );
  });

  it('is unknown while org units are off', async () => {
    const { service, getUserRoleAssignments } = makeService();
    getUserRoleAssignments.mockResolvedValue(err(404));

    await expect(check(service, ['applications'])).resolves.toBeUndefined();
  });

  it('is unknown when the rights cannot be read', async () => {
    const { service, getUserRoleAssignments } = makeService();
    getUserRoleAssignments.mockResolvedValue(err(500));
    vi.spyOn(Logger.prototype, 'warn').mockReturnValue(undefined);

    await expect(check(service, ['applications'])).resolves.toBeUndefined();
  });

  it('is unknown for a folder no unit owns', async () => {
    const { service } = rights({ adminAccess: 'NONE', items: [WRITER] });

    await expect(
      service.findMissingWriteNamespaces('user-1', 'token-1', 'Plain/Folder', [
        'applications',
      ]),
    ).resolves.toBeUndefined();
  });
});
