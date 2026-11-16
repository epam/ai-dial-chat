import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import {
  hasHiddenEntityTag,
  readHiddenEntityTags,
} from '../hidden-entity-tags.util';

const configWith = (tags: string[] | undefined) =>
  ({
    get: vi.fn((key: string) =>
      key === 'HIDDEN_ENTITY_TAGS' ? tags : undefined,
    ),
  }) as unknown as ConfigService<EnvironmentVariables>;

describe('readHiddenEntityTags', () => {
  it('returns the configured tags as a set', () => {
    expect([
      ...readHiddenEntityTags(configWith(['internal', 'HIDDEN'])),
    ]).toEqual(['internal', 'HIDDEN']);
  });

  it('returns an empty set when the variable is not configured', () => {
    expect(readHiddenEntityTags(configWith(undefined)).size).toBe(0);
  });
});

describe('hasHiddenEntityTag', () => {
  const tags = new Set(['internal', 'HIDDEN']);

  it('is true when a keyword is a hidden tag', () => {
    expect(hasHiddenEntityTag(['Text', 'HIDDEN'], tags)).toBe(true);
  });

  it('is true for any of several configured tags', () => {
    expect(hasHiddenEntityTag(['internal'], tags)).toBe(true);
  });

  it('matches exactly and case-sensitively', () => {
    expect(hasHiddenEntityTag(['hidden', 'HIDDEN-ish', 'Internal'], tags)).toBe(
      false,
    );
  });

  it('is false when no tag is configured', () => {
    expect(hasHiddenEntityTag(['HIDDEN'], new Set())).toBe(false);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'HIDDEN'],
    ['an object', { 0: 'HIDDEN' }],
  ])('is false when keywords is %s', (_label, keywords) => {
    expect(hasHiddenEntityTag(keywords, tags)).toBe(false);
  });

  it('ignores non-string keywords', () => {
    expect(hasHiddenEntityTag([1, null, { tag: 'HIDDEN' }], tags)).toBe(false);
  });
});
