import {
  BadGatewayException,
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
};
const RISK = {
  id: 'u-risk',
  name: 'US Risk',
  path: 'public/Acme/US Risk',
  folder: 'public/Acme/US%20Risk/',
};

const ok = (data: unknown) => ({ data, response: {} as Response }) as never;
const err = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

const makeService = () => {
  const getOrgUnit = vi.fn();
  const dialClient = {
    client: { getOrgUnit },
  } as unknown as DialClientService;
  const cache = new Map<string, unknown>();
  const cacheManager = {
    get: vi.fn(async (key: string) => cache.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      cache.set(key, value);
    }),
  };
  const service = new OrgUnitsService(dialClient, cacheManager as never);
  return { service, getOrgUnit, cacheManager };
};

describe('OrgUnitsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns every unit Core shows the caller, flat and in Core order', async () => {
    const { service, getOrgUnit } = makeService();
    getOrgUnit.mockResolvedValue(
      ok({ id: 'root', path: 'public', items: [ACME, RISK] }),
    );

    const result = await service.listOrgUnits('user-1', 'token-1');

    expect(result).toEqual({
      enabled: true,
      units: [ACME, { ...RISK, displayName: 'US Risk' }],
    });
    expect(getOrgUnit).toHaveBeenCalledWith(
      'public',
      expect.objectContaining({
        params: expect.objectContaining({ query: { recursive: true } }),
        headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
      }),
    );
  });

  it('falls back to the unit name when Core has no display name', async () => {
    const { service, getOrgUnit } = makeService();
    getOrgUnit.mockResolvedValue(ok({ items: [RISK] }));

    const { units } = await service.listOrgUnits('user-1', 'token-1');

    expect(units[0].displayName).toBe('US Risk');
  });

  it('drops a unit without a folder and keeps the rest', async () => {
    const { service, getOrgUnit } = makeService();
    getOrgUnit.mockResolvedValue(
      ok({ items: [{ ...ACME, folder: undefined }, RISK] }),
    );

    const { units } = await service.listOrgUnits('user-1', 'token-1');

    expect(units.map(({ id }) => id)).toEqual(['u-risk']);
  });

  it('returns an empty list when Core has no items', async () => {
    const { service, getOrgUnit } = makeService();
    getOrgUnit.mockResolvedValue(ok({ id: 'root' }));

    await expect(service.listOrgUnits('user-1', 'token-1')).resolves.toEqual({
      enabled: true,
      units: [],
    });
  });

  it('reports org units as disabled, and caches that, when Core answers 404', async () => {
    const { service, getOrgUnit, cacheManager } = makeService();
    getOrgUnit.mockResolvedValue(err(404));

    await expect(service.listOrgUnits('user-1', 'token-1')).resolves.toEqual({
      enabled: false,
      units: [],
    });
    expect(cacheManager.set).toHaveBeenCalledWith(
      'org-units:list:user-1',
      { enabled: false, units: [] },
      60_000,
    );
  });

  it.each([
    [401, UnauthorizedException],
    [403, ForbiddenException],
    [500, BadGatewayException],
  ])('maps a Core %i to %p and does not cache it', async (status, type) => {
    const { service, getOrgUnit, cacheManager } = makeService();
    getOrgUnit.mockResolvedValue(err(status));

    await expect(service.listOrgUnits('user-1', 'token-1')).rejects.toThrow(
      type,
    );
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('answers 503 when Core times out', async () => {
    const { service, getOrgUnit } = makeService();
    getOrgUnit.mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );

    await expect(service.listOrgUnits('user-1', 'token-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('serves a second call within the TTL from the cache', async () => {
    const { service, getOrgUnit } = makeService();
    getOrgUnit.mockResolvedValue(ok({ items: [ACME] }));

    await service.listOrgUnits('user-1', 'token-1');
    await service.listOrgUnits('user-1', 'token-1');

    expect(getOrgUnit).toHaveBeenCalledOnce();
  });

  it('keeps a separate cache entry per user', async () => {
    const { service, getOrgUnit, cacheManager } = makeService();
    getOrgUnit.mockResolvedValue(ok({ items: [ACME] }));

    await service.listOrgUnits('user-1', 'token-1');
    await service.listOrgUnits('user-2', 'token-2');

    expect(getOrgUnit).toHaveBeenCalledTimes(2);
    expect(cacheManager.set.mock.calls.map(([key]) => key)).toEqual([
      'org-units:list:user-1',
      'org-units:list:user-2',
    ]);
  });
});
