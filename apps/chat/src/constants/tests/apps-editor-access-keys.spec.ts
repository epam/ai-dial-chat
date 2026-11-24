import { describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en.json';
import { AppsEditorI18nKeys } from '../translation-keys';

const resolveKey = (key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node != null && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      en,
    );

const ACCESS_KEYS = Object.entries(AppsEditorI18nKeys).filter(([name]) =>
  name.startsWith('Access'),
);

describe('AppsEditorI18nKeys Access members', () => {
  it('lists the 23 keys of the Access section', () => {
    expect(ACCESS_KEYS).toHaveLength(23);
  });

  it.each(ACCESS_KEYS)('%s resolves to English text in en.json', (_, key) => {
    expect(typeof resolveKey(key)).toBe('string');
    expect(resolveKey(key)).not.toBe('');
  });

  it('interpolates the entry label in the three entry templates', () => {
    for (const key of [
      AppsEditorI18nKeys.AccessRemoveEntry,
      AppsEditorI18nKeys.AccessAnnounceAdded,
      AppsEditorI18nKeys.AccessAnnounceRemoved,
    ]) {
      expect(resolveKey(key)).toContain('{{label}}');
    }
  });
});
