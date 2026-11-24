import { describe, expect, it } from 'vitest';
import {
  AccessLevel,
  type AccessContentOption,
  type AccessEntry,
} from '../../models/access';
import {
  buildAccessDraft,
  isDraftCardEmpty,
  resetLevelForOption,
  toAccessEntries,
  withTrailingCard,
  type AccessDraftCard,
} from '../access-draft';

const card = (
  contentId: string,
  level: AccessLevel | '',
  id = `${contentId}-${level}`,
): AccessDraftCard => ({ id, contentId, level });

const readOnlyOption: AccessContentOption = {
  id: 'c',
  label: 'Gamma',
  allowedAccess: [AccessLevel.Read],
};
const readWriteOption: AccessContentOption = {
  id: 'a',
  label: 'Alpha',
  allowedAccess: [AccessLevel.Read, AccessLevel.ReadWrite],
};

describe('buildAccessDraft', () => {
  it('starts with one empty card when there are no entries', () => {
    const draft = buildAccessDraft([]);
    expect(draft).toHaveLength(1);
    expect(isDraftCardEmpty(draft[0])).toBe(true);
  });

  it('holds one card per entry, in order, plus one trailing empty card', () => {
    const entries: AccessEntry[] = [
      { contentId: 'a', level: AccessLevel.Read },
      { contentId: 'b', level: AccessLevel.ReadWrite },
    ];

    const draft = buildAccessDraft(entries);

    expect(draft.map((item) => [item.contentId, item.level])).toEqual([
      ['a', AccessLevel.Read],
      ['b', AccessLevel.ReadWrite],
      ['', ''],
    ]);
  });

  it('gives every card its own key', () => {
    const draft = buildAccessDraft([
      { contentId: 'a', level: AccessLevel.Read },
      { contentId: 'b', level: AccessLevel.Read },
    ]);
    expect(new Set(draft.map((item) => item.id)).size).toBe(3);
  });
});

describe('withTrailingCard', () => {
  it('appends an empty card after a complete last card', () => {
    const cards = [card('a', AccessLevel.Read)];
    const result = withTrailingCard(cards);
    expect(result).toHaveLength(2);
    expect(isDraftCardEmpty(result[1])).toBe(true);
  });

  it('leaves the list alone while the last card is only half filled', () => {
    const cards = [card('a', AccessLevel.Read), card('b', '')];
    expect(withTrailingCard(cards)).toBe(cards);
  });

  it('leaves the list alone while the last card is empty', () => {
    const cards = [card('', '')];
    expect(withTrailingCard(cards)).toBe(cards);
  });

  it('adds an empty card to an empty list', () => {
    expect(withTrailingCard([])).toHaveLength(1);
  });
});

describe('isDraftCardEmpty', () => {
  it('is true only when neither field is filled', () => {
    expect(isDraftCardEmpty(card('', ''))).toBe(true);
    expect(isDraftCardEmpty(card('a', ''))).toBe(false);
    expect(isDraftCardEmpty(card('', AccessLevel.Read))).toBe(false);
    expect(isDraftCardEmpty(card('a', AccessLevel.Read))).toBe(false);
  });
});

describe('resetLevelForOption', () => {
  it('keeps a level the option allows', () => {
    expect(resetLevelForOption(readWriteOption, AccessLevel.ReadWrite)).toBe(
      AccessLevel.ReadWrite,
    );
  });

  it('resets to read a level the option does not allow', () => {
    expect(resetLevelForOption(readOnlyOption, AccessLevel.ReadWrite)).toBe(
      AccessLevel.Read,
    );
  });

  it('leaves an unset level unset', () => {
    expect(resetLevelForOption(readOnlyOption, '')).toBe('');
  });

  it('leaves the level alone when the option is unknown', () => {
    expect(resetLevelForOption(undefined, AccessLevel.ReadWrite)).toBe(
      AccessLevel.ReadWrite,
    );
  });
});

describe('toAccessEntries', () => {
  it('keeps the complete cards in order and drops empty and half-filled ones', () => {
    const cards = [
      card('a', AccessLevel.Read),
      card('b', ''),
      card('', AccessLevel.Read),
      card('c', AccessLevel.ReadWrite),
      card('', ''),
    ];

    expect(toAccessEntries(cards)).toEqual([
      { contentId: 'a', level: AccessLevel.Read },
      { contentId: 'c', level: AccessLevel.ReadWrite },
    ]);
  });
});
