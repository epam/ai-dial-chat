import { describe, expect, it } from 'vitest';
import type { SkillMentionAnchor } from '../../models/skill-mention-anchor';
import {
  diffTextChange,
  findMentionAtCaret,
  insertAnchor,
  reconcileAnchors,
} from '../skill-mention-tracking';

const anchor = (
  overrides: Partial<SkillMentionAnchor> = {},
): SkillMentionAnchor => ({
  url: 'skills/bucket/abc',
  name: 'abc',
  start: 0,
  length: 4,
  ...overrides,
});

describe('diffTextChange', () => {
  it('detects a pure insert', () => {
    expect(diffTextChange('hello world', 'hello there world')).toEqual({
      start: 6,
      deletedLength: 0,
      insertedLength: 6,
    });
  });

  it('detects a pure delete', () => {
    expect(diffTextChange('hello there world', 'hello world')).toEqual({
      start: 6,
      deletedLength: 6,
      insertedLength: 0,
    });
  });

  it('detects a replace in the middle', () => {
    expect(diffTextChange('hello world', 'hello there')).toEqual({
      start: 6,
      deletedLength: 5,
      insertedLength: 5,
    });
  });

  it('reports no-op for identical strings', () => {
    expect(diffTextChange('same', 'same')).toEqual({
      start: 4,
      deletedLength: 0,
      insertedLength: 0,
    });
  });
});

describe('reconcileAnchors', () => {
  it('leaves an anchor entirely before the edit untouched', () => {
    const anchors = [anchor({ start: 0, length: 4 })];
    const result = reconcileAnchors(anchors, {
      start: 10,
      deletedLength: 0,
      insertedLength: 3,
    });

    expect(result).toEqual(anchors);
  });

  it('shifts an anchor entirely after an insert', () => {
    const anchors = [anchor({ start: 10, length: 4 })];
    const result = reconcileAnchors(anchors, {
      start: 0,
      deletedLength: 0,
      insertedLength: 5,
    });

    expect(result).toEqual([anchor({ start: 15, length: 4 })]);
  });

  it('shifts an anchor entirely after a delete', () => {
    const anchors = [anchor({ start: 10, length: 4 })];
    const result = reconcileAnchors(anchors, {
      start: 0,
      deletedLength: 5,
      insertedLength: 0,
    });

    expect(result).toEqual([anchor({ start: 5, length: 4 })]);
  });

  it('drops an anchor the edit overlaps', () => {
    const anchors = [anchor({ start: 5, length: 4 })];
    const result = reconcileAnchors(anchors, {
      start: 6,
      deletedLength: 1,
      insertedLength: 0,
    });

    expect(result).toEqual([]);
  });

  it('shifts multiple anchors by one edit, each independently', () => {
    const anchors = [
      anchor({ start: 0, length: 4, name: 'abc' }),
      anchor({ start: 20, length: 4, name: 'csd', url: 'skills/bucket/csd' }),
    ];
    const result = reconcileAnchors(anchors, {
      start: 10,
      deletedLength: 0,
      insertedLength: 6,
    });

    expect(result).toEqual([
      anchor({ start: 0, length: 4, name: 'abc' }),
      anchor({ start: 26, length: 4, name: 'csd', url: 'skills/bucket/csd' }),
    ]);
  });

  it('removes a whole mention via a synthetic whole-mention Backspace edit', () => {
    const anchors = [anchor({ start: 5, length: 4 })];
    const result = reconcileAnchors(anchors, {
      start: 5,
      deletedLength: 4,
      insertedLength: 0,
    });

    expect(result).toEqual([]);
  });
});

describe('insertAnchor', () => {
  it('inserts a new anchor at the caret', () => {
    const result = insertAnchor([], 0, 'skills/bucket/abc', 'abc', true);

    expect(result).toEqual([
      { url: 'skills/bucket/abc', name: 'abc', start: 0, length: 4 },
    ]);
  });

  it('shifts an existing later anchor by the inserted run length', () => {
    const existing = [anchor({ start: 5, length: 4, name: 'csd' })];
    const result = insertAnchor(existing, 0, 'skills/bucket/abc', 'abc', true);

    /* '/abc ' is 5 characters. */
    expect(result).toEqual([
      { url: 'skills/bucket/abc', name: 'abc', start: 0, length: 4 },
      anchor({ start: 10, length: 4, name: 'csd' }),
    ]);
  });

  it('keeps an earlier anchor untouched and orders the result by start', () => {
    const existing = [anchor({ start: 0, length: 4, name: 'abc' })];
    const result = insertAnchor(existing, 5, 'skills/bucket/csd', 'csd', true);

    expect(result).toEqual([
      anchor({ start: 0, length: 4, name: 'abc' }),
      { url: 'skills/bucket/csd', name: 'csd', start: 5, length: 4 },
    ]);
  });
});

describe('findMentionAtCaret', () => {
  it('finds the anchor whose mention run ends exactly at the caret', () => {
    const anchors = [anchor({ start: 0, length: 4 })];

    expect(findMentionAtCaret(anchors, 4)).toEqual(
      anchor({ start: 0, length: 4 }),
    );
  });

  it('returns undefined when the caret is not at any mention boundary', () => {
    const anchors = [anchor({ start: 0, length: 4 })];

    expect(findMentionAtCaret(anchors, 3)).toBeUndefined();
    expect(findMentionAtCaret(anchors, 5)).toBeUndefined();
  });

  it('returns undefined for an empty anchor list', () => {
    expect(findMentionAtCaret([], 0)).toBeUndefined();
  });
});
