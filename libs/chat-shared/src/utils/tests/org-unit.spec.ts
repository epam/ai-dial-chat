import { describe, expect, it } from 'vitest';
import type { OrgUnit } from '../../models/org-unit';
import {
  isOrgUnitFolder,
  normalizeOrgUnitFolder,
  toOrgUnitFolderSet,
} from '../org-unit';

const unit = (folder: string): OrgUnit => ({
  id: folder,
  name: folder,
  displayName: folder,
  path: folder,
  folder,
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

describe('isOrgUnitFolder', () => {
  const folders = toOrgUnitFolderSet([
    unit('public/Acme/'),
    unit('public/Acme/US%20Risk/'),
    unit('public/Risk/'),
    unit('public/public/'),
    unit('public/Q1%202026/'),
  ]);

  it('matches an encoded Core folder against a decoded tree path', () => {
    expect(isOrgUnitFolder(folders, 'Acme/US Risk')).toBe(true);
  });

  it('does not treat a folder inside a unit as a unit', () => {
    expect(isOrgUnitFolder(folders, 'Acme/Reports/')).toBe(false);
  });

  it('does not match a different name that shares a prefix', () => {
    expect(isOrgUnitFolder(folders, 'Risk2/')).toBe(false);
  });

  it('never matches the public root', () => {
    expect(isOrgUnitFolder(folders, '')).toBe(false);
  });

  it('matches a top-level unit folder named public', () => {
    expect(isOrgUnitFolder(folders, 'public')).toBe(true);
  });

  it('does not read a folder under a top-level public folder as a top-level unit', () => {
    expect(isOrgUnitFolder(folders, 'public/Acme')).toBe(false);
  });

  it('does not decode a tree path, so a literal %20 is not a space', () => {
    expect(isOrgUnitFolder(folders, 'Q1%202026')).toBe(false);
    expect(isOrgUnitFolder(folders, 'Q1 2026')).toBe(true);
  });
});
