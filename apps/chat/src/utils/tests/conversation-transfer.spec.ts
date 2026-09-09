import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationImportI18nKeys } from '../../constants/translation-keys';
import {
  formatTransferNameList,
  TRANSFER_NAME_LIST_LIMIT,
} from '../conversation-transfer';

describe('formatTransferNameList', () => {
  /*
   * Stands in for i18next: renders the `nameListWithRest` template so the
   * assertions read as the string a user would actually see.
   */
  const translate = vi.fn(
    (_key: string, options?: { names?: string; count?: number }) =>
      `${options?.names} and ${options?.count} others`,
  );
  const t = translate as unknown as TFunction;

  const namesOfLength = (length: number): string[] =>
    Array.from({ length }, (_, index) => `Name ${index + 1}`);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty string for no names', () => {
    expect(formatTransferNameList([], t)).toBe('');
    expect(translate).not.toHaveBeenCalled();
  });

  it('quotes and joins a list that fits within the limit', () => {
    expect(formatTransferNameList(['A', 'B', 'C'], t)).toBe('"A", "B", "C"');
    expect(translate).not.toHaveBeenCalled();
  });

  it('spells out every name when the list is exactly at the limit', () => {
    const names = namesOfLength(TRANSFER_NAME_LIST_LIMIT);

    expect(formatTransferNameList(names, t)).toBe(
      names.map((name) => `"${name}"`).join(', '),
    );
    expect(translate).not.toHaveBeenCalled();
  });

  it('summarizes the names beyond the limit as a count', () => {
    const names = namesOfLength(TRANSFER_NAME_LIST_LIMIT + 7);

    expect(formatTransferNameList(names, t)).toBe(
      '"Name 1", "Name 2", "Name 3", "Name 4", "Name 5" and 7 others',
    );
    expect(translate).toHaveBeenCalledWith(
      ConversationImportI18nKeys.NameListWithRest,
      {
        names: '"Name 1", "Name 2", "Name 3", "Name 4", "Name 5"',
        count: 7,
      },
    );
  });
});
