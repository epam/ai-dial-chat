import { OrgUnitsStatus } from '@epam/ai-dial-chat-hooks';
import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { useOrgUnitsContext } from '../../../context/OrgUnitsContext';
import { usePublishFolderGuards } from '../usePublishFolderGuards';

vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: vi.fn(),
}));
vi.mock('../../../context/OrgUnitsContext', () => ({
  useOrgUnitsContext: vi.fn(),
}));

const ensureUnits = vi.fn();
const canPublishAt = vi.fn((path: string) => path !== 'Acme/Secret');

const mockContext = (status: OrgUnitsStatus) =>
  vi.mocked(useOrgUnitsContext).mockReturnValue({
    status,
    ensureUnits,
    refreshUnits: vi.fn(),
    canWriteAt: vi.fn(),
    canSaveAt: vi.fn(),
    canSaveDirectlyAt: vi.fn(),
    canReadAt: vi.fn(),
    canPublishAt,
  });

describe('usePublishFolderGuards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    mockContext(OrgUnitsStatus.Ready);
  });

  it('asks the org units to load once the panel is active', () => {
    renderHook(() =>
      usePublishFolderGuards(OrgUnitNamespace.Applications, true),
    );

    expect(ensureUnits).toHaveBeenCalledOnce();
  });

  it('does not ask for the org units while no panel is active', () => {
    renderHook(() => usePublishFolderGuards(OrgUnitNamespace.Applications));

    expect(ensureUnits).not.toHaveBeenCalled();
  });

  it('asks for the org units when the panel opens', () => {
    const { rerender } = renderHook(
      ({ isActive }) =>
        usePublishFolderGuards(OrgUnitNamespace.Applications, isActive),
      { initialProps: { isActive: false } },
    );
    expect(ensureUnits).not.toHaveBeenCalled();

    rerender({ isActive: true });

    expect(ensureUnits).toHaveBeenCalledOnce();
  });

  it('blocks a unit folder without read and leaves other folders usable once Ready', () => {
    const { result } = renderHook(() =>
      usePublishFolderGuards(OrgUnitNamespace.Applications),
    );

    expect(result.current.canPublishTo?.(['Acme', 'Secret'])).toBe(false);
    expect(result.current.canPublishTo?.(['Production', 'Releases'])).toBe(
      true,
    );
    expect(canPublishAt).toHaveBeenCalledWith(
      'Production/Releases',
      OrgUnitNamespace.Applications,
    );
  });

  it('gives no guard while the flag is off, so Production stays blocked by the fallback', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);

    const { result } = renderHook(() =>
      usePublishFolderGuards(OrgUnitNamespace.Applications),
    );

    expect(result.current.canPublishTo).toBeUndefined();
  });

  it.each([OrgUnitsStatus.Idle, OrgUnitsStatus.Loading, OrgUnitsStatus.Error])(
    'gives no guard while the status is %s',
    (status) => {
      mockContext(status);

      const { result } = renderHook(() =>
        usePublishFolderGuards(OrgUnitNamespace.Applications),
      );

      expect(result.current.canPublishTo).toBeUndefined();
    },
  );

  it('keeps the same guard object while nothing it depends on changes', () => {
    const { result, rerender } = renderHook(() =>
      usePublishFolderGuards(OrgUnitNamespace.Applications),
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
