import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import { PublishDependencyType } from '@epam/ai-dial-publish-panel';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogPublishEntityType } from '../../catalog/publish';
import { SaveDestinationRoot } from '../../catalog/resource-save';
import {
  buildFolderGuards,
  getDependencyOrgUnitNamespaces,
  getMissingDirectWriteNamespaces,
  getOrgUnitNamespace,
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
