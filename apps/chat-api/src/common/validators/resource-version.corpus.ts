/**
 * Versions the shared rule must accept and reject. The same lists are
 * repeated in `libs/chat-shared` (`resource-version-pattern.spec.ts`) so the
 * two mirrored constants cannot drift.
 */
export const ACCEPTED_RESOURCE_VERSIONS: readonly string[] = [
  '1.0.0',
  'beta-2',
  '1.0+build5',
  '.hidden',
  '1',
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
];
