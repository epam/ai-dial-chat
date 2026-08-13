import { describe, expect, it } from 'vitest';
import { parseSkillResourceUrl } from '../skill';

describe('parseSkillResourceUrl', () => {
  it('splits a well-formed resource URL into bucket and path', () => {
    expect(
      parseSkillResourceUrl('skills/user-bucket/analysis/revenue'),
    ).toEqual({ bucket: 'user-bucket', path: 'analysis/revenue' });
  });

  it('keeps a root-level skill path intact', () => {
    expect(parseSkillResourceUrl('skills/user-bucket/revenue')).toEqual({
      bucket: 'user-bucket',
      path: 'revenue',
    });
  });

  it('returns null for a non-skill prefix', () => {
    expect(parseSkillResourceUrl('files/user-bucket/report.pdf')).toBeNull();
  });

  it('returns null when the bucket segment is empty', () => {
    expect(parseSkillResourceUrl('skills//revenue')).toBeNull();
  });

  it('returns null when the path is missing', () => {
    expect(parseSkillResourceUrl('skills/user-bucket')).toBeNull();
  });

  it('returns null when the path is empty', () => {
    expect(parseSkillResourceUrl('skills/user-bucket/')).toBeNull();
  });
});
