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

vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
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
const canCreatePublicFolderIn = vi.fn(() => true);

describe('useOrgUnitFolderGuards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    vi.mocked(useOrgUnitsContext).mockReturnValue({
      status: OrgUnitsStatus.Ready,
      isPublicFolderVisible: vi.fn(() => true),
      canCreatePublicFolderIn,
      ensureUnits,
      refreshUnits,
      canSaveAt,
      canSaveDirectlyAt,
      canPublishDirectlyAt: vi.fn(() => false),
      canPublishAt,
      hasAdminAccess: false,
    });
  });

  const getGuards = (
    purpose: OrgUnitFolderGuardPurpose,
    namespace: OrgUnitNamespace | undefined,
    isQuickApp = false,
  ) =>
    renderHook(() =>
      useOrgUnitFolderGuards({
        purpose,
        namespace,
        isActive: true,
        isQuickApp,
      }),
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
    expect(guards.isDestinationUsable?.(['Acme', 'Secret'])).toBe(false);
  });

  it('disables nothing while the flag is off, so the Production placeholder still applies', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);

    const guards = getGuards(
      OrgUnitFolderGuardPurpose.Publish,
      OrgUnitNamespace.Projects,
    );

    expect(guards.isDestinationUsable).toBeUndefined();
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
    expect(guards.isDestinationUsable).toBeUndefined();
  });

  describe('re-reading the rights on open', () => {
    const open = (isActive: boolean, shouldRefreshOnOpen: boolean) =>
      renderHook(() =>
        useOrgUnitFolderGuards({
          purpose: OrgUnitFolderGuardPurpose.Save,
          namespace: OrgUnitNamespace.Toolsets,
          isActive,
          shouldRefreshOnOpen,
        }),
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

  describe('loading the rights', () => {
    const usePublish = (isActive?: boolean) =>
      useOrgUnitFolderGuards({
        purpose: OrgUnitFolderGuardPurpose.Publish,
        namespace: OrgUnitNamespace.Applications,
        isActive,
      });

    it('asks the org units to load once the panel is active', () => {
      renderHook(() => usePublish(true));

      expect(ensureUnits).toHaveBeenCalledOnce();
    });

    it('does not ask for the org units while no panel is active', () => {
      renderHook(() => usePublish());

      expect(ensureUnits).not.toHaveBeenCalled();
    });

    it('asks for the org units when the panel opens', () => {
      const { rerender } = renderHook(({ isActive }) => usePublish(isActive), {
        initialProps: { isActive: false },
      });
      expect(ensureUnits).not.toHaveBeenCalled();

      rerender({ isActive: true });

      expect(ensureUnits).toHaveBeenCalledOnce();
    });

    it.each([
      OrgUnitsStatus.Idle,
      OrgUnitsStatus.Loading,
      OrgUnitsStatus.Error,
    ])('gives no publish guard while the status is %s', (status) => {
      vi.mocked(useOrgUnitsContext).mockReturnValue({
        ...vi.mocked(useOrgUnitsContext)(),
        status,
      });

      const { result } = renderHook(() => usePublish());

      expect(result.current.isDestinationUsable).toBeUndefined();
    });

    it('keeps the same guard object while nothing it depends on changes', () => {
      const { result, rerender } = renderHook(() => usePublish());
      const first = result.current;

      rerender();

      expect(result.current).toBe(first);
    });
  });

  describe('folder creation in the Organization root', () => {
    it('refuses creating a folder inside an org unit, next to one and at the root', () => {
      const guards = getGuards(
        OrgUnitFolderGuardPurpose.Publish,
        OrgUnitNamespace.Prompts,
      );

      expect(
        guards.canCreateFolderIn({ rootKey: '', path: ['Acme', 'Risk', 'Q1'] }),
      ).toBe(false);
      expect(
        guards.canCreateFolderIn({ rootKey: '', path: ['Acme', 'Risk'] }),
      ).toBe(false);
      expect(guards.canCreateFolderIn({ rootKey: '', path: ['Acme'] })).toBe(
        false,
      );
      expect(guards.canCreateFolderIn({ rootKey: '', path: [] })).toBe(false);
    });

    it.each([
      ['the org-units flag is off', false, OrgUnitsStatus.Ready],
      ['the units are loading', true, OrgUnitsStatus.Loading],
      ['DIAL Core has org units turned off', true, OrgUnitsStatus.Disabled],
    ])('refuses creating a folder while %s', (_case, isEnabled, status) => {
      vi.mocked(useFeatureFlag).mockReturnValue(isEnabled);
      vi.mocked(useOrgUnitsContext).mockReturnValue({
        ...vi.mocked(useOrgUnitsContext)(),
        status,
      });
      const guards = getGuards(
        OrgUnitFolderGuardPurpose.Publish,
        OrgUnitNamespace.Prompts,
      );

      expect(guards.canCreateFolderIn({ rootKey: '', path: [] })).toBe(false);
    });
  });

  describe('a selected folder the visibility rule hides', () => {
    const hideShared = () =>
      vi.mocked(useOrgUnitsContext).mockReturnValue({
        ...vi.mocked(useOrgUnitsContext)(),
        isPublicFolderVisible: vi.fn((path: string) => path !== 'Shared'),
      });

    it('is not usable for Publish and carries the hidden-folder reason', () => {
      hideShared();
      const guards = getGuards(
        OrgUnitFolderGuardPurpose.Publish,
        OrgUnitNamespace.Prompts,
      );

      expect(guards.isDestinationUsable?.(['Shared'])).toBe(false);
      expect(guards.getDisabledReason?.(['Shared'])).toBe(
        OrgUnitAccessI18nKeys.FolderOutsideOrgUnits,
      );
      expect(guards.isDestinationUsable?.(['Acme', 'Q1'])).toBe(true);
      expect(guards.getDisabledReason?.(['Acme', 'Secret'])).toBe(
        OrgUnitAccessI18nKeys.NoPublishAccessPrompt,
      );
    });

    it('disables the Save destination only on the Organization root', () => {
      hideShared();
      const guards = getGuards(
        OrgUnitFolderGuardPurpose.Save,
        OrgUnitNamespace.Toolsets,
      );

      expect(
        guards.getDisabledReason?.(
          ['Shared'],
          SaveDestinationRoot.Organization,
        ),
      ).toBe(OrgUnitAccessI18nKeys.FolderOutsideOrgUnits);
      expect(
        guards.getDisabledReason?.(['Shared'], SaveDestinationRoot.Personal),
      ).toBeUndefined();
    });

    it('keeps the Production placeholder for a visible folder when the rights give no guard', () => {
      hideShared();
      const guards = getGuards(OrgUnitFolderGuardPurpose.Publish, undefined);

      expect(guards.isDestinationUsable?.(['Shared'])).toBe(false);
      expect(guards.isDestinationUsable?.(['Acme', 'Production'])).toBe(false);
      expect(guards.isDestinationUsable?.(['Acme'])).toBe(true);
      expect(guards.getDisabledReason?.(['Acme'])).toBeUndefined();
    });

    it('hides nothing while the units are not Ready', () => {
      vi.mocked(useOrgUnitsContext).mockReturnValue({
        ...vi.mocked(useOrgUnitsContext)(),
        status: OrgUnitsStatus.Loading,
        isPublicFolderVisible: vi.fn(() => false),
      });
      const guards = getGuards(
        OrgUnitFolderGuardPurpose.Publish,
        OrgUnitNamespace.Prompts,
      );

      expect(guards.isDestinationUsable).toBeUndefined();
      expect(guards.getDisabledReason).toBeUndefined();
    });
  });

  it('allows creating a folder only in the Personal root of the Save tree', () => {
    const guards = getGuards(
      OrgUnitFolderGuardPurpose.Save,
      OrgUnitNamespace.Toolsets,
    );

    expect(
      guards.canCreateFolderIn({
        rootKey: SaveDestinationRoot.Personal,
        path: ['Shared'],
      }),
    ).toBe(true);
    expect(
      guards.canCreateFolderIn({
        rootKey: SaveDestinationRoot.Organization,
        path: ['Acme', 'Q1'],
      }),
    ).toBe(false);
  });
});
