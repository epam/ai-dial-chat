import { OrgUnitsStatus } from '@epam/ai-dial-chat-hooks';
import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { useEffect, type FC } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listOrgUnits } from '../../server-api/org-units.api';
import { useFeatureFlag } from '../AppConfigContext';
import { OrgUnitsProvider, useOrgUnitsContext } from '../OrgUnitsContext';

vi.mock('../../server-api/org-units.api', () => ({
  listOrgUnits: vi.fn(),
}));

vi.mock('../AppConfigContext', () => ({
  useFeatureFlag: vi.fn(),
}));

const Consumer: FC<{ name: string }> = ({ name }) => {
  const { ensureUnits, status } = useOrgUnitsContext();
  useEffect(() => ensureUnits(), [ensureUnits]);
  return <span>{`${name}: ${status}`}</span>;
};

describe('OrgUnitsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listOrgUnits).mockResolvedValue({
      enabled: true,
      hasAdminAccess: false,
      units: [],
    });
    vi.mocked(useFeatureFlag).mockImplementation(
      (key) => key === 'orgUnitsEnabled',
    );
  });

  it('does not read the units until a consumer asks for them', () => {
    render(
      <OrgUnitsProvider>
        <span>no consumer</span>
      </OrgUnitsProvider>,
    );

    expect(listOrgUnits).not.toHaveBeenCalled();
  });

  it('serves two consumers from one read', async () => {
    render(
      <OrgUnitsProvider>
        <Consumer name="file manager" />
        <Consumer name="publish panel" />
      </OrgUnitsProvider>,
    );

    expect(
      await screen.findByText(`publish panel: ${OrgUnitsStatus.Ready}`),
    ).toBeTruthy();
    expect(
      screen.getByText(`file manager: ${OrgUnitsStatus.Ready}`),
    ).toBeTruthy();
    expect(listOrgUnits).toHaveBeenCalledOnce();
  });

  it('never reads the units while the orgUnitsEnabled flag is off', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);

    render(
      <OrgUnitsProvider>
        <Consumer name="file manager" />
      </OrgUnitsProvider>,
    );

    expect(listOrgUnits).not.toHaveBeenCalled();
    expect(
      screen.getByText(`file manager: ${OrgUnitsStatus.Idle}`),
    ).toBeTruthy();
  });

  it('answers every right check true while the flag is off and refreshUnits reads nothing', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);
    const { result } = renderHook(() => useOrgUnitsContext(), {
      wrapper: OrgUnitsProvider,
    });

    act(() => result.current.refreshUnits());

    expect(
      result.current.canSaveAt('Acme', OrgUnitNamespace.Applications),
    ).toBe(true);
    expect(
      result.current.canPublishAt('Acme', OrgUnitNamespace.Applications),
    ).toBe(true);
    expect(result.current.isPublicFolderVisible('Shared')).toBe(true);
    expect(listOrgUnits).not.toHaveBeenCalled();
  });

  it('hides a plain public folder once the units are Ready, and none while the read fails', async () => {
    vi.mocked(listOrgUnits).mockResolvedValue({
      enabled: true,
      hasAdminAccess: false,
      units: [
        {
          id: 'u',
          name: 'Risk',
          displayName: 'Risk',
          path: 'public/Acme/Risk',
          folder: 'public/Acme/Risk/',
          permissions: {},
        },
      ],
    });
    const { result } = renderHook(() => useOrgUnitsContext(), {
      wrapper: OrgUnitsProvider,
    });
    expect(result.current.isPublicFolderVisible('Shared')).toBe(true);

    act(() => result.current.ensureUnits());
    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Ready),
    );

    expect(result.current.isPublicFolderVisible('Acme')).toBe(true);
    expect(result.current.isPublicFolderVisible('Acme/Risk/Q1')).toBe(true);
    expect(result.current.isPublicFolderVisible('Shared')).toBe(false);
  });

  it('hides nothing when the org-units read fails', async () => {
    vi.mocked(listOrgUnits).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useOrgUnitsContext(), {
      wrapper: OrgUnitsProvider,
    });

    act(() => result.current.ensureUnits());
    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Error),
    );

    expect(result.current.isPublicFolderVisible('Shared')).toBe(true);
  });

  it('exposes the hook result once the units are Ready, so a read-only unit is not writable', async () => {
    vi.mocked(listOrgUnits).mockResolvedValue({
      enabled: true,
      hasAdminAccess: false,
      units: [
        {
          id: 'u',
          name: 'Reports',
          displayName: 'Reports',
          path: 'public/Reports',
          folder: 'public/Reports/',
          permissions: { applications: ['read'] },
        },
      ],
    });
    const { result } = renderHook(() => useOrgUnitsContext(), {
      wrapper: OrgUnitsProvider,
    });

    act(() => result.current.ensureUnits());
    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Ready),
    );

    expect(
      result.current.canSaveAt('Reports/Q1', OrgUnitNamespace.Applications),
    ).toBe(false);
    expect(
      result.current.canPublishAt('Reports/Q1', OrgUnitNamespace.Applications),
    ).toBe(true);
  });

  it('answers canSaveDirectlyAt false until Ready, and only inside a unit that grants write', async () => {
    vi.mocked(listOrgUnits).mockResolvedValue({
      enabled: true,
      hasAdminAccess: true,
      units: [
        {
          id: 'u',
          name: 'Acme',
          displayName: 'Acme',
          path: 'public/Acme',
          folder: 'public/Acme/',
          permissions: { applications: ['read', 'write'] },
        },
      ],
    });
    const { result } = renderHook(() => useOrgUnitsContext(), {
      wrapper: OrgUnitsProvider,
    });
    expect(
      result.current.canSaveDirectlyAt(
        'Acme/Teams',
        OrgUnitNamespace.Applications,
      ),
    ).toBe(false);

    act(() => result.current.ensureUnits());
    await waitFor(() =>
      expect(result.current.status).toBe(OrgUnitsStatus.Ready),
    );

    expect(
      result.current.canSaveDirectlyAt(
        'Acme/Teams',
        OrgUnitNamespace.Applications,
      ),
    ).toBe(true);
    expect(
      result.current.canSaveDirectlyAt(
        'Plain/Folder',
        OrgUnitNamespace.Applications,
      ),
    ).toBe(false);
  });

  it('starts the read for an already mounted consumer once the flag turns on', async () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);
    const { rerender } = render(
      <OrgUnitsProvider>
        <Consumer name="file manager" />
      </OrgUnitsProvider>,
    );

    vi.mocked(useFeatureFlag).mockReturnValue(true);
    rerender(
      <OrgUnitsProvider>
        <Consumer name="file manager" />
      </OrgUnitsProvider>,
    );

    expect(
      await screen.findByText(`file manager: ${OrgUnitsStatus.Ready}`),
    ).toBeTruthy();
    expect(listOrgUnits).toHaveBeenCalledOnce();
  });

  it('throws a clear error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useOrgUnitsContext())).toThrow(
      'useOrgUnitsContext must be used within an OrgUnitsProvider',
    );
  });
});
