import { describe, expect, it, vi } from 'vitest';
import {
  OrgUnitNamespace,
  type OrgUnit,
  type OrgUnitAccess,
} from '../../models/org-unit';
import {
  canApprovePublicationsAt,
  canReadAt,
  canSaveToFolderAt,
  canWriteIntoOrgUnitAt,
  canRequestPublicationAt,
  canWriteAt,
  findOwningOrgUnit,
  normalizeOrgUnitFolder,
} from '../org-unit';

const unit = (
  folder: string,
  permissions: Record<string, string[]> = {},
): OrgUnit => ({
  id: folder,
  name: folder,
  displayName: folder,
  path: folder,
  folder,
  permissions,
});

describe('normalizeOrgUnitFolder', () => {
  it('decodes segments, strips the public root and keeps one trailing slash', () => {
    expect(normalizeOrgUnitFolder('public/Acme/US%20Risk/')).toBe(
      'Acme/US Risk/',
    );
  });

  it('keeps a malformed escape as written', () => {
    expect(normalizeOrgUnitFolder('public/100%/')).toBe('100%/');
  });

  it('returns an empty string for the public root', () => {
    expect(normalizeOrgUnitFolder('public/')).toBe('');
  });

  it('returns an empty string for a folder outside the public root', () => {
    expect(normalizeOrgUnitFolder('Acme/Risk/')).toBe('');
  });

  it('strips only the leading public root, not a unit named public', () => {
    expect(normalizeOrgUnitFolder('public/public/')).toBe('public/');
  });
});

const PERMISSIONS_RW = { applications: ['read', 'write'] };

const access = (units: OrgUnit[], hasAdminAccess = false): OrgUnitAccess => ({
  hasAdminAccess,
  units,
});

describe('findOwningOrgUnit', () => {
  const acme = unit('public/Acme/', PERMISSIONS_RW);
  const risk = unit('public/Acme/US%20Risk/', { applications: ['read'] });
  const units = [acme, risk, unit('public/Risk/')];

  it('picks the nearest unit for a nested folder', () => {
    expect(findOwningOrgUnit(units, 'Acme/US Risk/Reports/2026')).toBe(risk);
  });

  it('returns the unit for its own folder', () => {
    expect(findOwningOrgUnit(units, 'Acme')).toBe(acme);
    expect(findOwningOrgUnit(units, 'Acme/')).toBe(acme);
  });

  it('matches an encoded Core folder against a decoded path', () => {
    expect(findOwningOrgUnit(units, 'Acme/US Risk/Plans')).toBe(risk);
  });

  it('does not match a different name that shares a prefix', () => {
    expect(findOwningOrgUnit([unit('public/Risk/')], 'Risk2/Plans')).toBe(
      undefined,
    );
  });

  it('has no owner for the public root or a path under no unit', () => {
    expect(findOwningOrgUnit(units, '')).toBeUndefined();
    expect(findOwningOrgUnit(units, 'Plain/Folder')).toBeUndefined();
  });

  it('does not decode the tree path, so a literal %20 is not a space', () => {
    const quarter = unit('public/Q1%202026/');
    expect(findOwningOrgUnit([quarter], 'Q1%202026')).toBeUndefined();
    expect(findOwningOrgUnit([quarter], 'Q1 2026')).toBe(quarter);
  });

  it('does not guess missing parents: a unit reached only by path owns its own folders', () => {
    const lone = unit('public/Acme/US%20Risk/', PERMISSIONS_RW);
    expect(findOwningOrgUnit([lone], 'Acme/US Risk/Plans')).toBe(lone);
    expect(findOwningOrgUnit([lone], 'Acme/Other')).toBeUndefined();
  });
});

describe('canWriteAt and canReadAt', () => {
  const acme = unit('public/Acme/', PERMISSIONS_RW);
  const risk = unit('public/Acme/US%20Risk/', { applications: ['read'] });

  it('answers from the nearest unit: read without write', () => {
    const data = access([acme, risk]);
    const path = 'Acme/US Risk/Reports';

    expect(canReadAt(data, path, OrgUnitNamespace.Applications)).toBe(true);
    expect(canWriteAt(data, path, OrgUnitNamespace.Applications)).toBe(false);
  });

  it('returns false when the namespace has no entry', () => {
    const data = access([unit('public/Acme/', { prompts: ['read', 'write'] })]);

    expect(canWriteAt(data, 'Acme/X', OrgUnitNamespace.Applications)).toBe(
      false,
    );
  });

  it('returns false for an empty action list or absent permissions', () => {
    const empty = unit('public/Acme/', { applications: [] });
    const absent = { ...unit('public/Beta/'), permissions: undefined } as never;

    expect(
      canReadAt(access([empty]), 'Acme', OrgUnitNamespace.Applications),
    ).toBe(false);
    expect(
      canReadAt(access([absent]), 'Beta', OrgUnitNamespace.Applications),
    ).toBe(false);
  });

  it('does not imply read from write', () => {
    const data = access([unit('public/Acme/', { skills: ['write'] })]);

    expect(canWriteAt(data, 'Acme', OrgUnitNamespace.Skills)).toBe(true);
    expect(canReadAt(data, 'Acme', OrgUnitNamespace.Skills)).toBe(false);
  });

  it('ignores role names and decides from permissions', () => {
    const custom = {
      ...unit('public/Acme/', { skills: ['read', 'write'] }),
      roles: ['custom-curator'],
    };

    expect(
      canWriteAt(access([custom]), 'Acme/X', OrgUnitNamespace.Skills),
    ).toBe(true);
  });

  it('lets a DIAL admin write anywhere, owner or not', () => {
    expect(
      canWriteAt(
        access([], true),
        'Plain/Folder',
        OrgUnitNamespace.Applications,
      ),
    ).toBe(true);
  });

  it('denies a non-admin outside every unit', () => {
    const data = access([acme]);

    expect(
      canWriteAt(data, 'Plain/Folder', OrgUnitNamespace.Applications),
    ).toBe(false);
    expect(canReadAt(data, 'Plain/Folder', OrgUnitNamespace.Applications)).toBe(
      false,
    );
  });
});

describe('canRequestPublicationAt', () => {
  it('does not block a non-admin outside every unit', () => {
    expect(
      canRequestPublicationAt(
        access([unit('public/Acme/', PERMISSIONS_RW)]),
        'Plain/Folder',
        OrgUnitNamespace.Applications,
      ),
    ).toBe(true);
  });

  it('needs read on the owner inside a unit', () => {
    const noRead = access([unit('public/Acme/', { prompts: ['read'] })]);
    const withRead = access([unit('public/Acme/', { applications: ['read'] })]);

    expect(
      canRequestPublicationAt(noRead, 'Acme/X', OrgUnitNamespace.Applications),
    ).toBe(false);
    expect(
      canRequestPublicationAt(
        withRead,
        'Acme/X',
        OrgUnitNamespace.Applications,
      ),
    ).toBe(true);
  });

  it('lets a DIAL admin request anywhere', () => {
    expect(
      canRequestPublicationAt(
        access([unit('public/Acme/')], true),
        'Acme/X',
        OrgUnitNamespace.Applications,
      ),
    ).toBe(true);
  });
});

describe('canSaveToFolderAt', () => {
  const acme = unit('public/Acme/', PERMISSIONS_RW);
  const reports = unit('public/Reports/', { applications: ['read'] });
  const data = access([acme, reports]);

  it('does not block a non-admin on a folder outside every unit', () => {
    expect(
      canSaveToFolderAt(data, 'Plain/Folder', OrgUnitNamespace.Applications),
    ).toBe(true);
  });

  it('blocks a unit that grants no write', () => {
    expect(
      canSaveToFolderAt(data, 'Reports/Q1', OrgUnitNamespace.Applications),
    ).toBe(false);
  });

  it('allows a unit that grants write', () => {
    expect(
      canSaveToFolderAt(data, 'Acme/Plans', OrgUnitNamespace.Applications),
    ).toBe(true);
  });

  it('blocks a unit with write on another namespace only', () => {
    expect(canSaveToFolderAt(data, 'Acme/Plans', OrgUnitNamespace.Skills)).toBe(
      false,
    );
  });

  it('lets a DIAL admin save anywhere', () => {
    expect(
      canSaveToFolderAt(
        access([reports], true),
        'Reports/Q1',
        OrgUnitNamespace.Applications,
      ),
    ).toBe(true);
  });
});

describe('canWriteIntoOrgUnitAt', () => {
  const acme = unit('public/Acme/', PERMISSIONS_RW);
  const reports = unit('public/Reports/', { applications: ['read'] });
  const data = access([acme, reports]);

  it('allows a unit that grants write', () => {
    expect(
      canWriteIntoOrgUnitAt(data, 'Acme/Teams', OrgUnitNamespace.Applications),
    ).toBe(true);
  });

  it('refuses a unit without write', () => {
    expect(
      canWriteIntoOrgUnitAt(data, 'Reports/Q1', OrgUnitNamespace.Applications),
    ).toBe(false);
  });

  it('refuses a folder outside every unit for a non-admin', () => {
    expect(
      canWriteIntoOrgUnitAt(
        data,
        'Plain/Folder',
        OrgUnitNamespace.Applications,
      ),
    ).toBe(false);
  });

  it('refuses a folder outside every unit for a DIAL admin too', () => {
    expect(
      canWriteIntoOrgUnitAt(
        access([acme], true),
        'Plain/Folder',
        OrgUnitNamespace.Applications,
      ),
    ).toBe(false);
  });

  it('lets a DIAL admin write directly inside a unit', () => {
    expect(
      canWriteIntoOrgUnitAt(
        access([reports], true),
        'Reports/Q1',
        OrgUnitNamespace.Applications,
      ),
    ).toBe(true);
  });
});

describe('canApprovePublicationsAt', () => {
  const both = unit('public/Acme/', { publications: ['read', 'write'] });
  const readOnly = unit('public/RO/', { publications: ['read'] });
  const writeOnly = unit('public/WO/', { publications: ['write'] });
  const child = unit('public/Acme/Child/', { applications: ['write'] });
  const data = access([both, readOnly, writeOnly, child]);

  it('allows a unit granting read and write on publications', () => {
    expect(canApprovePublicationsAt(data, 'Acme/Teams')).toBe(true);
  });

  it('refuses read only', () => {
    expect(canApprovePublicationsAt(data, 'RO/Teams')).toBe(false);
  });

  it('refuses write only', () => {
    expect(canApprovePublicationsAt(data, 'WO/Teams')).toBe(false);
  });

  it('refuses a path under no unit', () => {
    expect(canApprovePublicationsAt(data, 'Plain/Folder')).toBe(false);
  });

  it('allows a DIAL admin anywhere', () => {
    expect(canApprovePublicationsAt(access([], true), 'Plain/Folder')).toBe(
      true,
    );
  });

  it('does not match a sibling folder sharing leading characters', () => {
    expect(canApprovePublicationsAt(data, 'Acme2/Teams')).toBe(false);
  });

  it('lets the child unit decide, not its parent', () => {
    expect(canApprovePublicationsAt(data, 'Acme/Child/Teams')).toBe(false);
  });
});

describe('findOwningOrgUnit caching', () => {
  it('decodes the unit folders once per units array, not once per call', () => {
    const units = [
      unit('public/Acme/US%20Risk/'),
      unit('public/Delivery/Teams/'),
    ];
    const decode = vi.spyOn(globalThis, 'decodeURIComponent');

    for (let call = 0; call < 50; call++) {
      findOwningOrgUnit(units, 'Acme/US Risk/Reports');
    }
    const decodedAfterMany = decode.mock.calls.length;
    findOwningOrgUnit(units, 'Delivery/Teams/Q1');

    expect(decodedAfterMany).toBe(4);
    expect(decode.mock.calls.length).toBe(decodedAfterMany);
    decode.mockRestore();
  });

  it('answers the same after the units array is replaced', () => {
    const first = [unit('public/Acme/')];
    const second = [unit('public/Beta/')];

    expect(findOwningOrgUnit(first, 'Acme/x')).toBeDefined();
    expect(findOwningOrgUnit(second, 'Acme/x')).toBeUndefined();
    expect(findOwningOrgUnit(second, 'Beta/x')).toBeDefined();
  });
});
