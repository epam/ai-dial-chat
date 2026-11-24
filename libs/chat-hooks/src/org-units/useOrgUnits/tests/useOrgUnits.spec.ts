import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrgUnitsStatus } from '../../types';
import { useOrgUnits } from '../useOrgUnits';

const ACME = {
  id: 'u-acme',
  name: 'Acme',
  displayName: 'Acme Corp',
  path: 'public/Acme',
  folder: 'public/Acme/',
  permissions: { applications: ['read', 'write'] },
};
const READ_ONLY = {
  id: 'u-ro',
  name: 'Reports',
  displayName: 'Reports',
  path: 'public/Reports',
  folder: 'public/Reports/',
  permissions: { applications: ['read'] },
};
const APPROVER = {
  id: 'u-del',
  name: 'Delivery',
  displayName: 'Delivery',
  path: 'public/Delivery',
  folder: 'public/Delivery/',
  permissions: {
    applications: ['read', 'write'],
    publications: ['read', 'write'],
  },
};
const WRITER = {
  ...APPROVER,
  id: 'u-wr',
  name: 'Writers',
  path: 'public/Writers',
  folder: 'public/Writers/',
  permissions: { applications: ['read', 'write'] },
};
const APPROVAL_ONLY = {
  ...APPROVER,
  id: 'u-ap',
  name: 'Approvers',
  path: 'public/Approvers',
  folder: 'public/Approvers/',
  permissions: { publications: ['read', 'write'] },
};
const APPS = OrgUnitNamespace.Applications;
const listResult = (
  units: unknown[],
  overrides: Record<string, unknown> = {},
) => ({ enabled: true, hasAdminAccess: false, units, ...overrides });

describe('useOrgUnits', () => {
  it('stays idle and reads nothing until ensureUnits is called', () => {
    const listOrgUnits = vi.fn();
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    expect(result.current.status).toBe(OrgUnitsStatus.Idle);
    expect(listOrgUnits).not.toHaveBeenCalled();
  });

  it('reads the units once however often ensureUnits is called', async () => {
    const listOrgUnits = vi.fn().mockResolvedValue(listResult([ACME]));
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => {
      result.current.ensureUnits();
      result.current.ensureUnits();
    });
    expect(result.current.status).toBe(OrgUnitsStatus.Loading);
    act(() => result.current.ensureUnits());

    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Ready),
    );
    expect(listOrgUnits).toHaveBeenCalledOnce();
    expect(result.current.canSaveAt('Acme/Plans', APPS)).toBe(true);
  });

  it('answers three calls from one load and disables a read-only unit once Ready', async () => {
    const listOrgUnits = vi
      .fn()
      .mockResolvedValue(listResult([ACME, READ_ONLY]));
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => {
      result.current.ensureUnits();
      result.current.ensureUnits();
      result.current.ensureUnits();
    });
    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Ready),
    );

    expect(listOrgUnits).toHaveBeenCalledOnce();
    expect(result.current.canPublishAt('Reports/Q1', APPS)).toBe(true);
    expect(result.current.canSaveDirectlyAt('Plain/Folder', APPS)).toBe(false);
    expect(result.current.canSaveAt('Plain/Folder', APPS)).toBe(true);
    expect(result.current.canSaveAt('Reports/Q1', APPS)).toBe(false);
    expect(result.current.canSaveAt('Acme/Plans', APPS)).toBe(true);
  });

  it('answers canSaveAt true until the status is Ready', () => {
    const listOrgUnits = vi.fn(() => new Promise<never>(() => undefined));
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    expect(result.current.canSaveAt('Reports/Q1', APPS)).toBe(true);
    act(() => result.current.ensureUnits());
    expect(result.current.canSaveAt('Reports/Q1', APPS)).toBe(true);
  });

  it('lets a DIAL admin write anywhere once Ready', async () => {
    const listOrgUnits = vi
      .fn()
      .mockResolvedValue(listResult([], { hasAdminAccess: true }));
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => result.current.ensureUnits());
    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Ready),
    );

    expect(result.current.canSaveAt('Plain/Folder', APPS)).toBe(true);
  });

  it('keeps the previous answer while refreshUnits reads again', async () => {
    let resolveRefresh: (value: unknown) => void = () => undefined;
    const listOrgUnits = vi
      .fn()
      .mockResolvedValueOnce(listResult([READ_ONLY]))
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolveRefresh = done;
          }),
      );
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));
    act(() => result.current.ensureUnits());
    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Ready),
    );

    act(() => result.current.refreshUnits());

    expect(result.current.status).toBe(OrgUnitsStatus.Ready);
    expect(result.current.canSaveAt('Reports/Q1', APPS)).toBe(false);
    await act(async () => resolveRefresh(listResult([ACME, READ_ONLY])));
    expect(listOrgUnits).toHaveBeenCalledTimes(2);
    expect(result.current.canSaveAt('Acme/Plans', APPS)).toBe(true);
  });

  it('does not read again on refreshUnits once org units are off', async () => {
    const listOrgUnits = vi
      .fn()
      .mockResolvedValue(listResult([], { enabled: false }));
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));
    act(() => result.current.ensureUnits());
    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Disabled),
    );

    act(() => result.current.refreshUnits());

    expect(listOrgUnits).toHaveBeenCalledOnce();
  });

  it('reports Disabled and allows every folder when org units are off', async () => {
    const listOrgUnits = vi
      .fn()
      .mockResolvedValue(listResult([], { enabled: false }));
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => result.current.ensureUnits());

    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Disabled),
    );
    expect(result.current.canSaveAt('Acme', APPS)).toBe(true);
  });

  it('reports Error without throwing when the read fails', async () => {
    const listOrgUnits = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => result.current.ensureUnits());

    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Error),
    );
    expect(result.current.canSaveAt('Acme', APPS)).toBe(true);
  });

  it('reads again on the next ensureUnits after a failed read', async () => {
    const listOrgUnits = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(listResult([ACME]));
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => result.current.ensureUnits());
    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Error),
    );
    act(() => result.current.ensureUnits());

    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Ready),
    );
    expect(listOrgUnits).toHaveBeenCalledTimes(2);
    expect(result.current.canSaveAt('Acme/Plans', APPS)).toBe(true);
  });

  it('does not read again after org units turn out to be off', async () => {
    const listOrgUnits = vi
      .fn()
      .mockResolvedValue(listResult([], { enabled: false }));
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => result.current.ensureUnits());
    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Disabled),
    );
    act(() => result.current.ensureUnits());

    expect(listOrgUnits).toHaveBeenCalledOnce();
  });

  it('allows every folder while the read is still in flight', () => {
    const listOrgUnits = vi.fn(() => new Promise<never>(() => undefined));
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => result.current.ensureUnits());

    expect(result.current.canSaveAt('Acme', APPS)).toBe(true);
  });

  it('does not update state after the owner unmounts', async () => {
    let resolve: (value: {
      enabled: boolean;
      hasAdminAccess: boolean;
      units: never[];
    }) => void = () => undefined;
    const listOrgUnits = vi.fn(
      () =>
        new Promise<{
          enabled: boolean;
          hasAdminAccess: boolean;
          units: never[];
        }>((done) => {
          resolve = done;
        }),
    );
    const consoleError = vi.spyOn(console, 'error');
    const { result, unmount } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => result.current.ensureUnits());
    unmount();
    await act(async () =>
      resolve({ enabled: true, hasAdminAccess: false, units: [] }),
    );

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  describe('hasAdminAccess', () => {
    it('is false until the status is Ready', () => {
      const listOrgUnits = vi.fn(() => new Promise<never>(() => undefined));
      const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

      act(() => result.current.ensureUnits());

      expect(result.current.hasAdminAccess).toBe(false);
    });

    it('follows the loaded access for a DIAL admin and for a unit-only role', async () => {
      const load = async (overrides: Record<string, unknown>) => {
        const listOrgUnits = vi
          .fn()
          .mockResolvedValue(listResult([ACME], overrides));
        const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));
        act(() => result.current.ensureUnits());
        await waitFor(() =>
          expect(result.current.status).toBe(OrgUnitsStatus.Ready),
        );
        return result.current.hasAdminAccess;
      };

      await expect(load({ hasAdminAccess: true })).resolves.toBe(true);
      await expect(load({ hasAdminAccess: false })).resolves.toBe(false);
    });

    it('is false when org units are off or the read fails', async () => {
      const off = vi.fn().mockResolvedValue({ enabled: false });
      const { result } = renderHook(() => useOrgUnits({ listOrgUnits: off }));
      act(() => result.current.ensureUnits());
      await waitFor(() =>
        expect(result.current.status).toBe(OrgUnitsStatus.Disabled),
      );

      expect(result.current.hasAdminAccess).toBe(false);
    });
  });

  describe('canPublishDirectlyAt', () => {
    const ready = async (
      units: unknown[],
      overrides: Record<string, unknown> = {},
    ) => {
      const listOrgUnits = vi
        .fn()
        .mockResolvedValue(listResult(units, overrides));
      const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));
      act(() => result.current.ensureUnits());
      await waitFor(() =>
        expect(result.current.status).toBe(OrgUnitsStatus.Ready),
      );
      return result;
    };

    it('is true for an approver who may write the namespace', async () => {
      const result = await ready([APPROVER, WRITER, APPROVAL_ONLY]);

      expect(result.current.canPublishDirectlyAt('Delivery/Teams', APPS)).toBe(
        true,
      );
    });

    it('is false for a writer without approval and for approval without write', async () => {
      const result = await ready([APPROVER, WRITER, APPROVAL_ONLY]);

      expect(result.current.canPublishDirectlyAt('Writers/Q1', APPS)).toBe(
        false,
      );
      expect(result.current.canPublishDirectlyAt('Approvers/Q1', APPS)).toBe(
        false,
      );
    });

    it('is false outside every unit, even for a DIAL admin, and true for an admin inside one', async () => {
      const result = await ready([WRITER], { hasAdminAccess: true });

      expect(result.current.canPublishDirectlyAt('Plain/Folder', APPS)).toBe(
        false,
      );
      expect(result.current.canPublishDirectlyAt('Writers/Q1', APPS)).toBe(
        true,
      );
    });

    it('leaves the existing answers unchanged', async () => {
      const result = await ready([APPROVER]);

      expect(result.current.canSaveDirectlyAt('Delivery/Teams', APPS)).toBe(
        true,
      );
      expect(result.current.canPublishAt('Delivery/Teams', APPS)).toBe(true);
    });

    it.each<[string, (() => Promise<unknown>) | undefined]>([
      ['Idle', undefined],
      ['Loading', () => new Promise<never>(() => undefined)],
      ['Disabled', () => Promise.resolve({ enabled: false })],
      ['Error', () => Promise.reject(new Error('boom'))],
    ])('is false while the status is %s', async (_name, outcome) => {
      const listOrgUnits = vi.fn(outcome as () => Promise<never>);
      const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));
      if (outcome) act(() => result.current.ensureUnits());
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.canPublishDirectlyAt('Delivery/Teams', APPS)).toBe(
        false,
      );
    });
  });

  describe('isPublicFolderVisible', () => {
    it('lists only the org-unit tree once the units are ready', async () => {
      const listOrgUnits = vi.fn().mockResolvedValue(listResult([ACME]));
      const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));
      act(() => result.current.ensureUnits());
      await waitFor(() =>
        expect(result.current.status).toBe(OrgUnitsStatus.Ready),
      );

      expect(result.current.isPublicFolderVisible('Acme')).toBe(true);
      expect(result.current.isPublicFolderVisible('Acme/Reports')).toBe(true);
      expect(result.current.isPublicFolderVisible('Shared')).toBe(false);
    });

    it('follows the units a refresh brings', async () => {
      const listOrgUnits = vi
        .fn()
        .mockResolvedValueOnce(listResult([ACME]))
        .mockResolvedValueOnce(listResult([ACME, READ_ONLY]));
      const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));
      act(() => result.current.ensureUnits());
      await waitFor(() =>
        expect(result.current.status).toBe(OrgUnitsStatus.Ready),
      );
      expect(result.current.isPublicFolderVisible('Reports')).toBe(false);

      act(() => result.current.refreshUnits());

      await waitFor(() =>
        expect(result.current.isPublicFolderVisible('Reports')).toBe(true),
      );
    });

    it.each<[string, (() => Promise<unknown>) | undefined]>([
      ['Idle', undefined],
      ['Loading', () => new Promise<never>(() => undefined)],
      ['Disabled', () => Promise.resolve({ enabled: false })],
      ['Error', () => Promise.reject(new Error('boom'))],
    ])('hides nothing while the status is %s', async (_name, outcome) => {
      const listOrgUnits = vi.fn(outcome as () => Promise<never>);
      const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));
      if (outcome) act(() => result.current.ensureUnits());
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isPublicFolderVisible('Shared')).toBe(true);
    });
  });
});
