import { describe, expect, it } from 'vitest';
import { resolveClaimPath, toRoleList } from '../claims.util';

describe('resolveClaimPath', () => {
  it('reads a flat key when the path has no dots', () => {
    expect(resolveClaimPath({ roles: ['R'] }, 'roles')).toEqual(['R']);
  });

  it('walks a dot-separated path into nested objects', () => {
    expect(
      resolveClaimPath(
        { realm_access: { roles: ['R'] } },
        'realm_access.roles',
      ),
    ).toEqual(['R']);
  });

  it('returns undefined when a path segment is missing', () => {
    expect(resolveClaimPath({ realm_access: {} }, 'realm_access.roles')).toBe(
      undefined,
    );
  });

  it('returns undefined when a path crosses a primitive value', () => {
    expect(
      resolveClaimPath({ realm_access: 'flat' }, 'realm_access.roles'),
    ).toBe(undefined);
  });

  it('returns undefined when a path crosses null', () => {
    expect(resolveClaimPath({ realm_access: null }, 'realm_access.roles')).toBe(
      undefined,
    );
  });

  it('does not treat a flat dotted key as a nested path', () => {
    expect(
      resolveClaimPath({ 'realm_access.roles': ['R'] }, 'realm_access.roles'),
    ).toBe(undefined);
  });
});

describe('toRoleList', () => {
  it('keeps a string array as-is', () => {
    expect(toRoleList(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('coerces non-string array entries with String', () => {
    expect(toRoleList(['R', 7, true, null])).toEqual([
      'R',
      '7',
      'true',
      'null',
    ]);
  });

  it('turns a single string into a one-element list', () => {
    expect(toRoleList('admin')).toEqual(['admin']);
  });

  it.each([undefined, null, 7, { role: 'admin' }])(
    'returns an empty list for %s',
    (value) => {
      expect(toRoleList(value)).toEqual([]);
    },
  );
});
