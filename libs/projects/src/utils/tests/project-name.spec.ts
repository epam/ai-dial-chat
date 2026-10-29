import { describe, expect, it } from 'vitest';
import { ProjectNameError } from '../../types/project-name-error';
import { validateProjectName } from '../project-name';

/* The same accept/reject table as the BFF's `dial-entity-name.validator.spec.ts`,
 * so a name the form accepts is one `POST /api/v1/projects` accepts. */
describe('validateProjectName', () => {
  it.each([
    'Handbook',
    'Q4 launch',
    'Отчёт Q4 — 2026',
    'release-1.2_notes',
    'what? #1 (draft)',
    'a'.repeat(255),
    'ж'.repeat(127),
  ])('accepts %s', (name) => {
    expect(validateProjectName(name)).toBeNull();
  });

  it('accepts a name with surrounding whitespace, which the host trims', () => {
    expect(validateProjectName('  Handbook  ')).toBeNull();
  });

  it.each(['', '   '])('reports an empty name %j as required', (name) => {
    expect(validateProjectName(name)).toBe(ProjectNameError.Required);
  });

  it.each([
    'a/b',
    '../other',
    'a\\b',
    'a:b',
    '50%',
    'say "hi"',
    'a\tb',
    'a\u0000b',
    'a\nb',
    'a‮b',
  ])('reports %j as containing invalid characters', (name) => {
    expect(validateProjectName(name)).toBe(ProjectNameError.InvalidCharacters);
  });

  it.each(['.', '..', 'v', 'files', '.dial-resource', '.dial-folder'])(
    'reports the reserved name %s',
    (name) => {
      expect(validateProjectName(name)).toBe(ProjectNameError.Reserved);
    },
  );

  it.each(['a'.repeat(256), 'ж'.repeat(128)])(
    'reports a name over 255 UTF-8 bytes as too long',
    (name) => {
      expect(validateProjectName(name)).toBe(ProjectNameError.TooLong);
    },
  );
});
