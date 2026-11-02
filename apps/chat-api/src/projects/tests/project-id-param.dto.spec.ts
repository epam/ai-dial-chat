import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ProjectFileParamDto,
  ProjectIdParamDto,
} from '../dto/project-id-param.dto';
import {
  buildSiblingProjectId,
  parseProjectId,
} from '../utils/project-id.util';

const validateId = (id: unknown) =>
  validateSync(plainToInstance(ProjectIdParamDto, { id }));
const validateFile = (id: unknown, fileName: unknown) =>
  validateSync(plainToInstance(ProjectFileParamDto, { id, fileName }));

describe('ProjectIdParamDto', () => {
  it.each([
    'projects/a1b2c3/q4-launch',
    'projects/a1b2c3/marketing/2026/q4-launch',
    'projects/public/Справочник',
    'projects/a1b2c3/Q4 launch #1?',
  ])('accepts %s', (id) => {
    expect(validateId(id)).toHaveLength(0);
  });

  it.each([
    ['traversal', 'projects/a1b2c3/../other'],
    ['a dot segment', 'projects/a1b2c3/./x'],
    ['an empty segment', 'projects/a1b2c3//x'],
    ['a trailing slash', 'projects/a1b2c3/x/'],
    ['no path', 'projects/a1b2c3'],
    ['a foreign prefix', 'skills/a1b2c3/q4'],
    ['a control character', 'projects/a1b2c3/q\u00074'],
    ['a dot bucket', 'projects/../x'],
    ['a non-string', 42],
  ])('rejects %s', (_label, id) => {
    expect(validateId(id)).not.toHaveLength(0);
  });
});

describe('ProjectFileParamDto', () => {
  it('accepts a plain file name', () => {
    expect(validateFile('projects/a1b2c3/q4', 'tickets.csv')).toHaveLength(0);
  });

  it.each(['../secret', 'a/b.csv', '', '..', 'files'])(
    'rejects the file name %j',
    (fileName) => {
      const errors = validateFile('projects/a1b2c3/q4', fileName);
      expect(errors.map((error) => error.property)).toEqual(['fileName']);
    },
  );
});

describe('parseProjectId', () => {
  it('splits a nested id into bucket, path, parent and name', () => {
    expect(parseProjectId('projects/a1b2c3/marketing/q4')).toEqual({
      id: 'projects/a1b2c3/marketing/q4',
      bucket: 'a1b2c3',
      path: 'marketing/q4',
      parentPath: 'marketing',
      name: 'q4',
    });
  });

  it('has no parent path at the bucket root', () => {
    expect(parseProjectId('projects/a1b2c3/q4')?.parentPath).toBeUndefined();
  });

  it('builds a sibling in the same folder', () => {
    const parsed = parseProjectId('projects/a1b2c3/marketing/q4');
    expect(parsed && buildSiblingProjectId(parsed, 'Q4 launch').id).toBe(
      'projects/a1b2c3/marketing/Q4 launch',
    );
  });
});
