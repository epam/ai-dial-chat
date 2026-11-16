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
};

describe('useOrgUnits', () => {
  it('stays idle and reads nothing until ensureUnits is called', () => {
    const listOrgUnits = vi.fn();
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    expect(result.current.status).toBe(OrgUnitsStatus.Idle);
    expect(listOrgUnits).not.toHaveBeenCalled();
  });

  it('reads the units once however often ensureUnits is called', async () => {
    const listOrgUnits = vi
      .fn()
      .mockResolvedValue({ enabled: true, units: [ACME] });
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
    expect(result.current.isOrgUnitFolder('Acme')).toBe(true);
    expect(result.current.isOrgUnitFolder('Acme/Reports')).toBe(false);
  });

  it('reports Disabled and matches no folder when org units are off', async () => {
    const listOrgUnits = vi
      .fn()
      .mockResolvedValue({ enabled: false, units: [] });
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => result.current.ensureUnits());

    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Disabled),
    );
    expect(result.current.isOrgUnitFolder('Acme')).toBe(false);
  });

  it('reports Error without throwing when the read fails', async () => {
    const listOrgUnits = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => result.current.ensureUnits());

    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Error),
    );
    expect(result.current.isOrgUnitFolder('Acme')).toBe(false);
  });

  it('reads again on the next ensureUnits after a failed read', async () => {
    const listOrgUnits = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ enabled: true, units: [ACME] });
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
    expect(result.current.isOrgUnitFolder('Acme')).toBe(true);
  });

  it('does not read again after org units turn out to be off', async () => {
    const listOrgUnits = vi
      .fn()
      .mockResolvedValue({ enabled: false, units: [] });
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => result.current.ensureUnits());
    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Disabled),
    );
    act(() => result.current.ensureUnits());

    expect(listOrgUnits).toHaveBeenCalledOnce();
  });

  it('matches no folder while the read is still in flight', () => {
    const listOrgUnits = vi.fn(() => new Promise<never>(() => undefined));
    const { result } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => result.current.ensureUnits());

    expect(result.current.isOrgUnitFolder('Acme')).toBe(false);
  });

  it('does not update state after the owner unmounts', async () => {
    let resolve: (value: { enabled: boolean; units: never[] }) => void = () =>
      undefined;
    const listOrgUnits = vi.fn(
      () =>
        new Promise<{ enabled: boolean; units: never[] }>((done) => {
          resolve = done;
        }),
    );
    const consoleError = vi.spyOn(console, 'error');
    const { result, unmount } = renderHook(() => useOrgUnits({ listOrgUnits }));

    act(() => result.current.ensureUnits());
    unmount();
    await act(async () => resolve({ enabled: true, units: [] }));

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
