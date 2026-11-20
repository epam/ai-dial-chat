import { describe, expect, it } from 'vitest';
import type { OrgUnitDto } from '../dto/org-unit.dto';
import {
  canWriteAt,
  canWriteIntoOrgUnitAt,
  findOwningOrgUnit,
  normalizeOrgUnitFolder,
} from '../org-unit-rights.util';

const unit = (
  folder: string,
  permissions: Record<string, string[]> = {},
): OrgUnitDto => ({
  id: folder,
  name: folder,
  displayName: folder,
  path: folder,
  folder,
  permissions,
});

const access = (units: OrgUnitDto[], hasAdminAccess = false) => ({
  hasAdminAccess,
  units,
});

const RW = { applications: ['read', 'write'] };

/* Cases mirror `libs/chat-shared/src/utils/tests/org-unit.spec.ts`. */
describe('normalizeOrgUnitFolder', () => {
  it('decodes segments, strips the public root and keeps one trailing slash', () => {
    expect(normalizeOrgUnitFolder('public/Acme/US%20Risk/')).toBe(
      'Acme/US Risk/',
    );
  });

  it('keeps a malformed escape as written', () => {
    expect(normalizeOrgUnitFolder('public/100%/')).toBe('100%/');
  });

  it('returns an empty string for the public root and for a folder outside it', () => {
    expect(normalizeOrgUnitFolder('public/')).toBe('');
    expect(normalizeOrgUnitFolder('Acme/Risk/')).toBe('');
  });

  it('strips only the leading public root, not a unit named public', () => {
    expect(normalizeOrgUnitFolder('public/public/')).toBe('public/');
  });
});

describe('findOwningOrgUnit', () => {
  const acme = unit('public/Acme/', RW);
  const risk = unit('public/Acme/US%20Risk/', { applications: ['read'] });
  const units = [acme, risk, unit('public/Risk/')];

  it('picks the nearest unit for a nested folder', () => {
    expect(findOwningOrgUnit(units, 'Acme/US Risk/Reports/2026')).toBe(risk);
  });

  it('returns the unit for its own folder', () => {
    expect(findOwningOrgUnit(units, 'Acme')).toBe(acme);
    expect(findOwningOrgUnit(units, 'Acme/')).toBe(acme);
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

  it('does not decode the path, so a literal %20 is not a space', () => {
    const quarter = unit('public/Q1%202026/');
    expect(findOwningOrgUnit([quarter], 'Q1%202026')).toBeUndefined();
    expect(findOwningOrgUnit([quarter], 'Q1 2026')).toBe(quarter);
  });
});

describe('canWriteAt', () => {
  const acme = unit('public/Acme/', RW);
  const risk = unit('public/Acme/US%20Risk/', { applications: ['read'] });

  it('answers from the nearest unit: read without write', () => {
    expect(
      canWriteAt(access([acme, risk]), 'Acme/US Risk/R', 'applications'),
    ).toBe(false);
    expect(canWriteAt(access([acme, risk]), 'Acme/Other', 'applications')).toBe(
      true,
    );
  });

  it('is false when the namespace has no entry, an empty list or absent permissions', () => {
    const absent = { ...unit('public/Beta/'), permissions: undefined } as never;
    expect(
      canWriteAt(
        access([unit('public/Acme/', { prompts: ['write'] })]),
        'Acme',
        'applications',
      ),
    ).toBe(false);
    expect(
      canWriteAt(
        access([unit('public/Acme/', { applications: [] })]),
        'Acme',
        'applications',
      ),
    ).toBe(false);
    expect(canWriteAt(access([absent]), 'Beta', 'applications')).toBe(false);
  });

  it('ignores role names and decides from permissions', () => {
    const custom = {
      ...unit('public/Acme/', { skills: ['read', 'write'] }),
      roles: ['x'],
    };
    expect(canWriteAt(access([custom]), 'Acme/X', 'skills')).toBe(true);
  });

  it('lets an admin write anywhere', () => {
    expect(canWriteAt(access([], true), 'Anything', 'applications')).toBe(true);
  });
});

describe('canWriteIntoOrgUnitAt', () => {
  it('is true for a writer inside a unit and for an admin inside a unit', () => {
    const units = [unit('public/Acme/', RW)];
    expect(
      canWriteIntoOrgUnitAt(access(units), 'Acme/Teams', 'applications'),
    ).toBe(true);
    expect(
      canWriteIntoOrgUnitAt(
        access([unit('public/Acme/')], true),
        'Acme/Teams',
        'applications',
      ),
    ).toBe(true);
  });

  it('is false for a reader and for a path under no unit, even for an admin', () => {
    const units = [unit('public/Acme/', { applications: ['read'] })];
    expect(
      canWriteIntoOrgUnitAt(access(units), 'Acme/Teams', 'applications'),
    ).toBe(false);
    expect(
      canWriteIntoOrgUnitAt(
        access(units, true),
        'Plain/Folder',
        'applications',
      ),
    ).toBe(false);
  });
});
