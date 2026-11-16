import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrgUnitFolderGuardPurpose } from '../../org-unit-guards';
import { OrgUnitsStatus } from '../../types';
import { useFolderGuards, type FolderGuardsOrgUnits } from '../useFolderGuards';

const ensureUnits = vi.fn();
const refreshUnits = vi.fn();

const makeOrgUnits = (
  overrides: Partial<FolderGuardsOrgUnits> = {},
): FolderGuardsOrgUnits => ({
  status: OrgUnitsStatus.Ready,
  ensureUnits,
  refreshUnits,
  canSaveAt: (path) => path !== 'Acme/Reports',
  canPublishAt: (path) => path !== 'Acme/Secret',
  canSaveDirectlyAt: () => true,
  ...overrides,
});

const getReason = () => 'No access';

const getGuards = ({
  purpose = OrgUnitFolderGuardPurpose.Save,
  isActive = true,
  isEnabled = true,
  shouldRefreshOnOpen = false,
  orgUnits = makeOrgUnits(),
}: {
  purpose?: OrgUnitFolderGuardPurpose;
  isActive?: boolean;
  isEnabled?: boolean;
  shouldRefreshOnOpen?: boolean;
  orgUnits?: FolderGuardsOrgUnits;
} = {}) =>
  renderHook(() =>
    useFolderGuards({
      purpose,
      namespace: OrgUnitNamespace.Toolsets,
      isActive,
      isEnabled,
      orgUnits,
      shouldRefreshOnOpen,
      getReason,
    }),
  ).result.current;

describe('useFolderGuards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts the read while the panel is active and not while it is closed', () => {
    getGuards({ isActive: false });
    expect(ensureUnits).not.toHaveBeenCalled();

    getGuards({ isActive: true });
    expect(ensureUnits).toHaveBeenCalled();
  });

  it('starts no read and no refresh while the flag is off, even for a raw useOrgUnits result', () => {
    getGuards({ isEnabled: false, shouldRefreshOnOpen: true });

    expect(ensureUnits).not.toHaveBeenCalled();
    expect(refreshUnits).not.toHaveBeenCalled();
  });

  it('uses canSaveAt for Save and canPublishAt for Publish', () => {
    const save = getGuards({ purpose: OrgUnitFolderGuardPurpose.Save });
    const publish = getGuards({
      purpose: OrgUnitFolderGuardPurpose.Publish,
    });

    expect(save.getDisabledReason?.(['Acme', 'Reports'])).toBe('No access');
    expect(save.getDisabledReason?.(['Acme', 'Secret'])).toBeUndefined();
    expect(publish.getDisabledReason?.(['Acme', 'Secret'])).toBe('No access');
    expect(publish.getDisabledReason?.(['Acme', 'Reports'])).toBeUndefined();
  });

  it('offers the strict direct-save check only to a Save panel', () => {
    const save = getGuards({ purpose: OrgUnitFolderGuardPurpose.Save });
    const publish = getGuards({
      purpose: OrgUnitFolderGuardPurpose.Publish,
    });

    expect(save.canSaveDirectlyTo).toBeDefined();
    expect(publish.canSaveDirectlyTo).toBeUndefined();
  });

  it('refreshes loaded rights when the panel opens and asks to', () => {
    getGuards({ shouldRefreshOnOpen: true });

    expect(refreshUnits).toHaveBeenCalledOnce();
  });

  it.each([
    ['it is not asked to', { shouldRefreshOnOpen: false }],
    ['the panel is closed', { isActive: false, shouldRefreshOnOpen: true }],
    [
      'the rights are not loaded yet',
      {
        shouldRefreshOnOpen: true,
        orgUnits: makeOrgUnits({ status: OrgUnitsStatus.Loading }),
      },
    ],
  ])('does not refresh when %s', (_label, options) => {
    getGuards(options);

    expect(refreshUnits).not.toHaveBeenCalled();
  });

  it.each([
    ['the flag is off', { isEnabled: false }],
    [
      'the rights are not Ready',
      { orgUnits: makeOrgUnits({ status: OrgUnitsStatus.Error }) },
    ],
  ])('returns no guards when %s', (_label, options) => {
    const guards = getGuards(options);

    expect(guards.canPublishTo).toBeUndefined();
    expect(guards.getDisabledReason).toBeUndefined();
    expect(guards.canSaveDirectlyTo).toBeUndefined();
  });
});
