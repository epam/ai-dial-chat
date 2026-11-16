import { describe, expect, it } from 'vitest';
import { applyDeploymentRoleGate } from '../deployment-role-gate';

describe('applyDeploymentRoleGate', () => {
  it.each([
    ['allowed caller', true, ['beta'], ['staff', 'beta'], true],
    ['restricted caller', true, ['beta'], ['staff'], false],
    ['anonymous caller', true, ['beta'], undefined, false],
    ['caller with no roles', true, ['beta'], [], false],
    ['unrestricted (no list)', true, undefined, ['staff'], true],
    ['unrestricted (empty list)', true, [], undefined, true],
    ['already off for an allowed caller', false, ['beta'], ['beta'], false],
    [
      'no value selected, unrestricted',
      undefined,
      undefined,
      undefined,
      undefined,
    ],
    ['no value selected, restricted', undefined, ['beta'], ['staff'], false],
  ] as const)('%s', (_name, selected, allowed, roles, expected) => {
    expect(applyDeploymentRoleGate(selected, allowed, roles)).toBe(expected);
  });

  it('never turns a value on', () => {
    expect(applyDeploymentRoleGate(false, ['beta'], ['beta'])).toBe(false);
    expect(applyDeploymentRoleGate(false, undefined, undefined)).toBe(false);
  });
});
