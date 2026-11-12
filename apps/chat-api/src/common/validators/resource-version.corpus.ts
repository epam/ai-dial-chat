/**
 * Versions the shared rule must accept and reject. The spec of the mirrored
 * constant in `libs/chat-shared` (`resource-version-pattern.spec.ts`) reads
 * this file and runs the same lists, so the two constants cannot drift.
 */
export const ACCEPTED_RESOURCE_VERSIONS: readonly string[] = [
  '1.0.0',
  'beta-2',
  '1.0+build5',
  '.hidden',
  '1',
  '1_0',
  'v1_',
  'a'.repeat(64),
];

export const REJECTED_RESOURCE_VERSIONS: readonly string[] = [
  '',
  'a'.repeat(65),
  '1.0.',
  '1.',
  '.',
  '..',
  '1 0',
  '1/0',
  '1:0',
  '1;0',
  '1%2B',
  '1\n',
  '\u00e91',
  '1__2',
  '1.0__',
  '__',
  '_',
  '_1',
];
