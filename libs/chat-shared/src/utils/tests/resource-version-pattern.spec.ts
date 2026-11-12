import { describe, expect, it } from 'vitest';
import { RESOURCE_VERSION_PATTERN } from '../resource-version';

/* Same corpus as apps/chat-api/src/common/validators/resource-version.corpus.ts. */
const ACCEPTED = [
  '1.0.0',
  'beta-2',
  '1.0+build5',
  '.hidden',
  '1',
  'a'.repeat(64),
];
const REJECTED = [
  '',
  'a'.repeat(65),
  '1.0.',
  '1.',
  '.',
  '..',
  '1 0',
  '1/0',
  '1:0',
];

describe('RESOURCE_VERSION_PATTERN', () => {
  it.each(ACCEPTED)('accepts %s', (version) => {
    expect(RESOURCE_VERSION_PATTERN.test(version)).toBe(true);
  });

  it.each(REJECTED)('rejects "%s"', (version) => {
    expect(RESOURCE_VERSION_PATTERN.test(version)).toBe(false);
  });
});
