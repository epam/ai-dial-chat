import {
  OrgUnitFolderGuardPurpose,
  OrgUnitsStatus,
  SaveDestinationRoot,
} from '@epam/ai-dial-chat-hooks';
import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrgUnitAccessI18nKeys } from '../../../constants/translation-keys';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { useOrgUnitsContext } from '../../../context/OrgUnitsContext';
import { useOrgUnitFolderGuards } from '../useOrgUnitFolderGuards';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: vi.fn(),
}));
vi.mock('../../../context/OrgUnitsContext', () => ({
  useOrgUnitsContext: vi.fn(),
}));

const canSaveAt = vi.fn((path: string) => path !== 'Acme/Reports');
const canPublishAt = vi.fn((path: string) => path !== 'Acme/Secret');
const canSaveDirectlyAt = vi.fn(() => true);
const ensureUnits = vi.fn();
const refreshUnits = vi.fn();

describe('useOrgUnitFolderGuards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    vi.mocked(useOrgUnitsContext).mockReturnValue({
      status: OrgUnitsStatus.Ready,
      ensureUnits,
      refreshUnits,
      canWriteAt: vi.fn(),
      canSaveAt,
      canSaveDirectlyAt,
      canReadAt: vi.fn(),
      canPublishAt,
    });
  });

  const getGuards = (
    purpose: OrgUnitFolderGuardPurpose,
    namespace: OrgUnitNamespace | undefined,
    isQuickApp = false,
  ) =>
    renderHook(() =>
      useOrgUnitFolderGuards(purpose, namespace, true, isQuickApp),
    ).result.current;

  it('uses canSaveAt for Save and gives the typed save reason', () => {
    const guards = getGuards(
      OrgUnitFolderGuardPurpose.Save,
      OrgUnitNamespace.Toolsets,
    );

    expect(guards.getDisabledReason?.(['Acme', 'Reports'])).toBe(
      OrgUnitAccessI18nKeys.NoSaveAccessToolset,
    );
    expect(guards.getDisabledReason?.(['Acme', 'Secret'])).toBeUndefined();
  });

  it('uses canPublishAt for Publish and gives the typed publish reason', () => {
    const guards = getGuards(
      OrgUnitFolderGuardPurpose.Publish,
      OrgUnitNamespace.Prompts,
    );

    expect(guards.getDisabledReason?.(['Acme', 'Secret'])).toBe(
      OrgUnitAccessI18nKeys.NoPublishAccessPrompt,
    );
    expect(guards.getDisabledReason?.(['Acme', 'Reports'])).toBeUndefined();
    expect(guards.canSaveDirectlyTo).toBeUndefined();
  });

  it('keeps a Personal folder usable in the Save panel', () => {
    const guards = getGuards(
      OrgUnitFolderGuardPurpose.Save,
      OrgUnitNamespace.Toolsets,
    );

    expect(
      guards.getDisabledReason?.(
        ['Acme', 'Reports'],
        SaveDestinationRoot.Personal,
      ),
    ).toBeUndefined();
  });

  it('names a Quick App "QuickApp" and any other application "application"', () => {
    const quick = getGuards(
      OrgUnitFolderGuardPurpose.Save,
      OrgUnitNamespace.Applications,
      true,
    );
    const other = getGuards(
      OrgUnitFolderGuardPurpose.Save,
      OrgUnitNamespace.Applications,
    );

    expect(quick.getDisabledReason?.(['Acme', 'Reports'])).toBe(
      OrgUnitAccessI18nKeys.NoSaveAccessQuickApp,
    );
    expect(other.getDisabledReason?.(['Acme', 'Reports'])).toBe(
      OrgUnitAccessI18nKeys.NoSaveAccessApplication,
    );
  });

  it('disables a unit folder the user may not request publication to, and keeps a plain folder enabled', () => {
    const guards = getGuards(
      OrgUnitFolderGuardPurpose.Publish,
      OrgUnitNamespace.Conversations,
    );

    expect(guards.getDisabledReason?.(['Acme', 'Secret'])).toBe(
      OrgUnitAccessI18nKeys.NoPublishAccessConversation,
    );
    expect(guards.getDisabledReason?.(['Plain'])).toBeUndefined();
    expect(guards.canPublishTo?.(['Acme', 'Secret'])).toBe(false);
  });

  it('disables nothing while the flag is off, so the Production placeholder still applies', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);

    const guards = getGuards(
      OrgUnitFolderGuardPurpose.Publish,
      OrgUnitNamespace.Projects,
    );

    expect(guards.canPublishTo).toBeUndefined();
    expect(guards.getDisabledReason).toBeUndefined();
  });

  it('returns no guards while the rights are not loaded', () => {
    vi.mocked(useOrgUnitsContext).mockReturnValue({
      ...vi.mocked(useOrgUnitsContext)(),
      status: OrgUnitsStatus.Loading,
    });

    const guards = getGuards(
      OrgUnitFolderGuardPurpose.Save,
      OrgUnitNamespace.Toolsets,
    );

    expect(guards.getDisabledReason).toBeUndefined();
    expect(guards.canPublishTo).toBeUndefined();
  });

  describe('re-reading the rights on open', () => {
    const open = (isActive: boolean, shouldRefreshOnOpen: boolean) =>
      renderHook(() =>
        useOrgUnitFolderGuards(
          OrgUnitFolderGuardPurpose.Save,
          OrgUnitNamespace.Toolsets,
          isActive,
          false,
          shouldRefreshOnOpen,
        ),
      );

    it('refreshes already loaded rights when the panel opens and asks to refresh', () => {
      open(true, true);

      expect(refreshUnits).toHaveBeenCalledOnce();
    });

    it('does not refresh when the panel is not asked to', () => {
      open(true, false);

      expect(refreshUnits).not.toHaveBeenCalled();
    });

    it('does not refresh while the panel is closed', () => {
      open(false, true);

      expect(refreshUnits).not.toHaveBeenCalled();
      expect(ensureUnits).not.toHaveBeenCalled();
    });

    it('leaves the first load to ensureUnits when the rights are not loaded yet', () => {
      vi.mocked(useOrgUnitsContext).mockReturnValue({
        ...vi.mocked(useOrgUnitsContext)(),
        status: OrgUnitsStatus.Idle,
      });

      open(true, true);

      expect(ensureUnits).toHaveBeenCalled();
      expect(refreshUnits).not.toHaveBeenCalled();
    });
  });
});
