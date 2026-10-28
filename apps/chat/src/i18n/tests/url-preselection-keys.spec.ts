import { describe, expect, it } from 'vitest';
import { UrlPreselectionI18nKeys } from '../../constants/translation-keys';
import en from '../locales/en.json';

const resolveKey = (key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        (node as Record<string, unknown> | undefined)?.[segment],
      en,
    );

describe('UrlPreselectionI18nKeys', () => {
  it.each(Object.values(UrlPreselectionI18nKeys))(
    'resolves %s to a non-empty string in en.json',
    (key) => {
      const value = resolveKey(key);

      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    },
  );
});
