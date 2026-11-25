import { CatalogEntityType, OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import { PublishDependencyType } from '@epam/ai-dial-publish-panel';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogPublishEntityType } from '../../catalog/publish';
import { SaveDestinationRoot } from '../../catalog/resource-save';
import {
  buildFolderGuards,
  getDependencyOrgUnitNamespaces,
  getDependencyTypeOfNamespace,
  getMissingDirectWriteNamespaces,
  getOrgUnitNamespace,
  getCatalogPublishDirectAvailability,
  getPublishDirectAvailability,
  OrgUnitFolderGuardPurpose,
  toPublishDisabledReason,
  type BuildFolderGuardsParams,
} from '../org-unit-guards';
import { OrgUnitsStatus } from '../types';

describe('getOrgUnitNamespace', () => {
  it.each<[CatalogPublishEntityType, OrgUnitNamespace | undefined]>([
    ['application', OrgUnitNamespace.Applications],
    ['toolset', OrgUnitNamespace.Toolsets],
    ['prompt', OrgUnitNamespace.Prompts],
    ['skill', OrgUnitNamespace.Skills],
    ['project', OrgUnitNamespace.Projects],
    ['model', undefined],
  ])('maps the %s entity type to %s', (entityType, expected) => {
    expect(getOrgUnitNamespace(entityType)).toBe(expected);
  });
});

describe('buildFolderGuards', () => {
  const buildGuards = (overrides: Partial<BuildFolderGuardsParams> = {}) => {
    const canSaveAt = vi.fn((path: string) => path !== 'Acme/Reports');
    const canPublishAt = vi.fn((path: string) => path !== 'Acme/Secret');
    const canSaveDirectlyAt = vi.fn((path: string) => path.startsWith('Acme'));
    const getReason = vi.fn(() => 'No access');
    const guards = buildFolderGuards({
      purpose: OrgUnitFolderGuardPurpose.Save,
      isEnabled: true,
      status: OrgUnitsStatus.Ready,
      namespace: OrgUnitNamespace.Applications,
      canSaveAt,
      canPublishAt,
      canSaveDirectlyAt,
      getReason,
      ...overrides,
    });
    return { guards, canSaveAt, canPublishAt, canSaveDirectlyAt, getReason };
  };

  it('uses canSaveAt for a save panel and passes the joined path and namespace', () => {
    const { guards, canSaveAt, canPublishAt } = buildGuards();

    expect(guards.isDestinationUsable?.(['Acme', 'Reports'])).toBe(false);
    expect(guards.isDestinationUsable?.(['Acme', 'Secret'])).toBe(true);
    expect(canSaveAt).toHaveBeenCalledWith(
      'Acme/Reports',
      OrgUnitNamespace.Applications,
    );
    expect(canPublishAt).not.toHaveBeenCalled();
  });

  it('has no reason callback when the host gives no getReason', () => {
    const { guards } = buildGuards({ getReason: undefined });

    expect(guards.isDestinationUsable).toBeDefined();
    expect(guards.getDisabledReason).toBeUndefined();
  });

  it('leaves a folder outside every unit usable in a save panel', () => {
    const { guards } = buildGuards();

    expect(guards.getDisabledReason?.(['Plain', 'Folder'])).toBeUndefined();
  });

  it('never disables a Personal folder, even one named like a unit without write', () => {
    const { guards, canSaveAt, getReason } = buildGuards();

    expect(
      guards.isDestinationUsable?.(
        ['Acme', 'Reports'],
        SaveDestinationRoot.Personal,
      ),
    ).toBe(true);
    expect(
      guards.getDisabledReason?.(
        ['Acme', 'Reports'],
        SaveDestinationRoot.Personal,
      ),
    ).toBeUndefined();
    expect(canSaveAt).not.toHaveBeenCalled();
    expect(getReason).not.toHaveBeenCalled();
  });

  it('matches an Organization folder against the units, with the root given or omitted', () => {
    const { guards } = buildGuards();

    expect(
      guards.isDestinationUsable?.(
        ['Acme', 'Reports'],
        SaveDestinationRoot.Organization,
      ),
    ).toBe(false);
    expect(guards.isDestinationUsable?.(['Acme', 'Reports'])).toBe(false);
    expect(
      guards.getDisabledReason?.(
        ['Acme', 'Reports'],
        SaveDestinationRoot.Organization,
      ),
    ).toBe('No access');
  });

  it('never direct-writes into a Personal folder, even one named like a writable unit', () => {
    const { guards, canSaveDirectlyAt } = buildGuards();

    expect(
      guards.canSaveDirectlyTo?.(
        ['Acme', 'Teams'],
        SaveDestinationRoot.Personal,
      ),
    ).toBe(false);
    expect(canSaveDirectlyAt).not.toHaveBeenCalled();
    expect(
      guards.canSaveDirectlyTo?.(
        ['Acme', 'Teams'],
        SaveDestinationRoot.Organization,
      ),
    ).toBe(true);
  });

  it('answers direct save from the strict check with the joined path and namespace', () => {
    const { guards, canSaveDirectlyAt } = buildGuards();

    expect(guards.canSaveDirectlyTo?.(['Acme', 'Teams'])).toBe(true);
    expect(guards.canSaveDirectlyTo?.(['Plain'])).toBe(false);
    expect(canSaveDirectlyAt).toHaveBeenCalledWith(
      'Acme/Teams',
      OrgUnitNamespace.Applications,
    );
  });

  it('has no direct-save guard when the host gives no strict check', () => {
    const { guards } = buildGuards({ canSaveDirectlyAt: undefined });

    expect(guards.canSaveDirectlyTo).toBeUndefined();
  });

  it('uses canPublishAt for a publish panel', () => {
    const { guards } = buildGuards({
      purpose: OrgUnitFolderGuardPurpose.Publish,
    });

    expect(guards.isDestinationUsable?.(['Acme', 'Secret'])).toBe(false);
    expect(guards.isDestinationUsable?.(['Acme', 'Reports'])).toBe(true);
  });

  it('returns the injected reason only for a disabled folder', () => {
    const { guards, getReason } = buildGuards();

    expect(guards.getDisabledReason?.(['Acme', 'Reports'])).toBe('No access');
    expect(guards.getDisabledReason?.(['Plain'])).toBeUndefined();
    expect(getReason).toHaveBeenCalledOnce();
    expect(getReason).toHaveBeenCalledWith(['Acme', 'Reports']);
  });

  it.each([
    ['the flag is off', { isEnabled: false }],
    ['the rights are not loaded', { status: OrgUnitsStatus.Loading }],
    ['the read failed', { status: OrgUnitsStatus.Error }],
    ['Core has org units off', { status: OrgUnitsStatus.Disabled }],
    ['the type has no namespace', { namespace: undefined }],
  ])('returns no guards when %s', (_label, overrides) => {
    const { guards } = buildGuards(overrides);

    expect(guards.isDestinationUsable).toBeUndefined();
    expect(guards.getDisabledReason).toBeUndefined();
    expect(guards.canSaveDirectlyTo).toBeUndefined();
  });
});

describe('toPublishDisabledReason', () => {
  it('judges only the destination path', () => {
    const getDisabledReason = vi.fn().mockReturnValue('No access');

    const adapted = toPublishDisabledReason(getDisabledReason);

    expect(adapted?.({ path: ['Acme', 'Secret'] })).toBe('No access');
    expect(getDisabledReason).toHaveBeenCalledWith(['Acme', 'Secret']);
  });

  it('stays undefined while the guard has no reason callback', () => {
    expect(toPublishDisabledReason(undefined)).toBeUndefined();
  });
});

describe('getDependencyOrgUnitNamespaces', () => {
  it('maps each kind to its namespace once and drops files', () => {
    expect(
      getDependencyOrgUnitNamespaces([
        { type: PublishDependencyType.Prompt },
        { type: PublishDependencyType.Skill },
        { type: PublishDependencyType.Prompt },
        { type: PublishDependencyType.Toolset },
        { type: PublishDependencyType.Application },
        { type: PublishDependencyType.File },
      ]),
    ).toEqual([
      OrgUnitNamespace.Prompts,
      OrgUnitNamespace.Skills,
      OrgUnitNamespace.Toolsets,
      OrgUnitNamespace.Applications,
    ]);
  });

  it('is empty for no dependencies and for files only', () => {
    expect(getDependencyOrgUnitNamespaces([])).toEqual([]);
    expect(
      getDependencyOrgUnitNamespaces([{ type: PublishDependencyType.File }]),
    ).toEqual([]);
  });
});

describe('getDependencyTypeOfNamespace', () => {
  it('names the dependency kind of a namespace and none for others', () => {
    expect(getDependencyTypeOfNamespace(OrgUnitNamespace.Prompts)).toBe(
      PublishDependencyType.Prompt,
    );
    expect(getDependencyTypeOfNamespace(OrgUnitNamespace.Applications)).toBe(
      PublishDependencyType.Application,
    );
    expect(
      getDependencyTypeOfNamespace(OrgUnitNamespace.Files),
    ).toBeUndefined();
  });
});

describe('getMissingDirectWriteNamespaces', () => {
  const canSaveDirectlyAt = vi.fn(
    (path: string, namespace: OrgUnitNamespace) =>
      path.startsWith('Acme') && namespace !== OrgUnitNamespace.Toolsets,
  );
  const ready = {
    isEnabled: true,
    status: OrgUnitsStatus.Ready,
    canSaveDirectlyAt,
  };
  const namespaces = [OrgUnitNamespace.Prompts, OrgUnitNamespace.Toolsets];

  it('returns the namespaces the strict check refuses, with the joined path', () => {
    expect(
      getMissingDirectWriteNamespaces(ready, ['Acme', 'Teams'], namespaces),
    ).toEqual([OrgUnitNamespace.Toolsets]);
    expect(canSaveDirectlyAt).toHaveBeenCalledWith(
      'Acme/Teams',
      OrgUnitNamespace.Prompts,
    );
  });

  it('returns every namespace for a folder the user cannot write', () => {
    expect(
      getMissingDirectWriteNamespaces(ready, ['Other'], namespaces),
    ).toEqual(namespaces);
  });

  it.each([
    [{ ...ready, isEnabled: false }],
    [{ ...ready, status: OrgUnitsStatus.Loading }],
    [{ ...ready, status: OrgUnitsStatus.Error }],
  ])('returns nothing while the rights are not known', (params) => {
    expect(
      getMissingDirectWriteNamespaces(params, ['Other'], namespaces),
    ).toEqual([]);
  });
});

const dep = (type: PublishDependencyType, isFolder = false) => ({
  type,
  isFolder,
});

describe('getPublishDirectAvailability', () => {
  const APPS = OrgUnitNamespace.Applications;
  const NONE = {
    isDirect: false,
    missingNamespaces: [],
    missingTypes: [],
    hasFolderReference: false,
  };
  const checks = (
    canPublish: boolean,
    writable: OrgUnitNamespace[],
    hasAdminAccess = false,
  ): Parameters<typeof getPublishDirectAvailability>[3] => ({
    canPublishDirectlyAt: () => canPublish,
    canSaveDirectlyAt: (_path, namespace) => writable.includes(namespace),
    hasAdminAccess,
  });

  it('is direct when every right is present', () => {
    expect(
      getPublishDirectAvailability(
        ['Acme'],
        APPS,
        [dep(PublishDependencyType.Toolset)],
        checks(true, [OrgUnitNamespace.Toolsets]),
      ),
    ).toEqual({ ...NONE, isDirect: true });
  });

  it('names the dependency namespaces the user may not write', () => {
    expect(
      getPublishDirectAvailability(
        ['Acme'],
        APPS,
        [dep(PublishDependencyType.Toolset), dep(PublishDependencyType.Prompt)],
        checks(true, [OrgUnitNamespace.Prompts]),
      ),
    ).toEqual({
      ...NONE,
      missingNamespaces: [OrgUnitNamespace.Toolsets],
      missingTypes: [PublishDependencyType.Toolset],
    });
  });

  it('is direct without dependencies', () => {
    expect(
      getPublishDirectAvailability(['Acme'], APPS, [], checks(true, [])),
    ).toEqual({ ...NONE, isDirect: true });
  });

  it('never lets a plain file dependency block', () => {
    expect(
      getPublishDirectAvailability(
        ['Acme'],
        APPS,
        [dep(PublishDependencyType.File)],
        checks(true, []),
      ),
    ).toEqual({ ...NONE, isDirect: true });
  });

  it('names nothing when the entity itself may not be published directly', () => {
    expect(
      getPublishDirectAvailability(
        ['Acme'],
        APPS,
        [
          dep(PublishDependencyType.Toolset),
          dep(PublishDependencyType.File, true),
        ],
        checks(false, []),
      ),
    ).toEqual(NONE);
  });

  describe('a folder reference', () => {
    const folder = dep(PublishDependencyType.File, true);

    it('is not direct for an application when the user is not a DIAL admin', () => {
      expect(
        getPublishDirectAvailability(
          ['Acme'],
          APPS,
          [folder],
          checks(true, []),
        ),
      ).toEqual({ ...NONE, hasFolderReference: true });
    });

    it('is reported next to a missing dependency namespace, with both lists', () => {
      expect(
        getPublishDirectAvailability(
          ['Acme'],
          APPS,
          [dep(PublishDependencyType.Toolset), folder],
          checks(true, []),
        ),
      ).toEqual({
        ...NONE,
        hasFolderReference: true,
        missingNamespaces: [OrgUnitNamespace.Toolsets],
        missingTypes: [PublishDependencyType.Toolset],
      });
    });

    it('stays direct for a DIAL admin', () => {
      expect(
        getPublishDirectAvailability(
          ['Acme'],
          APPS,
          [folder],
          checks(true, [], true),
        ),
      ).toEqual({ ...NONE, isDirect: true });
    });

    it('does not apply to a toolset, prompt or skill', () => {
      expect(
        getPublishDirectAvailability(
          ['Acme'],
          OrgUnitNamespace.Prompts,
          [folder],
          checks(true, []),
        ),
      ).toEqual({ ...NONE, isDirect: true });
    });
  });
});

describe('getCatalogPublishDirectAvailability', () => {
  const checks = {
    canPublishDirectlyAt: () => true,
    canSaveDirectlyAt: (_path: string, namespace: OrgUnitNamespace) =>
      namespace !== OrgUnitNamespace.Toolsets,
    hasAdminAccess: false,
  };

  it('maps the item type to its namespace and names the missing dependency types', () => {
    expect(
      getCatalogPublishDirectAvailability(
        CatalogEntityType.Agent,
        ['Acme'],
        [dep(PublishDependencyType.Toolset), dep(PublishDependencyType.Prompt)],
        checks,
      ),
    ).toEqual({
      isDirect: false,
      missingNamespaces: [OrgUnitNamespace.Toolsets],
      missingTypes: [PublishDependencyType.Toolset],
      hasFolderReference: false,
    });
  });

  it('is direct when nothing is missing', () => {
    expect(
      getCatalogPublishDirectAvailability(
        CatalogEntityType.Prompt,
        ['Acme'],
        [],
        checks,
      ).isDirect,
    ).toBe(true);
  });

  it('flags a folder reference of an agent for a user who is not a DIAL admin', () => {
    expect(
      getCatalogPublishDirectAvailability(
        CatalogEntityType.Agent,
        ['Acme'],
        [dep(PublishDependencyType.File, true)],
        checks,
      ),
    ).toMatchObject({ isDirect: false, hasFolderReference: true });
  });

  it('is never direct for a type that cannot be published', () => {
    expect(
      getCatalogPublishDirectAvailability(
        CatalogEntityType.Model,
        ['Acme'],
        [],
        checks,
      ),
    ).toEqual({
      isDirect: false,
      missingNamespaces: [],
      missingTypes: [],
      hasFolderReference: false,
    });
  });
});
