import { describe, expect, it } from 'vitest';
import { isSafeDeploymentId } from './safe-deployment-id.validator';

describe('isSafeDeploymentId', () => {
  it.each([
    'gpt-4o',
    'applications/bucket/My App',
    'toolsets/public/folder/my-toolset',
    'applications/bucket/name?#*',
  ])('accepts the valid deployment identifier %s', (value) => {
    expect(isSafeDeploymentId(value)).toBe(true);
  });

  it.each([
    '',
    '../etc/passwd',
    'applications/./name',
    'applications//name',
    'applications/%2e%2e/name',
    'applications/%2E%2Fname',
    'applications/name%0Ainjected',
  ])('rejects the unsafe deployment identifier %s', (value) => {
    expect(isSafeDeploymentId(value)).toBe(false);
  });
});
