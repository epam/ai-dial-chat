import {
  canonicalizeContentLocales,
  parseContentLocaleList,
} from '../../config/content-locales';

const readNewList = (value: unknown): string[] | undefined =>
  parseContentLocaleList(value);

const readLegacyList = (value: unknown): string[] | undefined =>
  parseContentLocaleList(value, { stripLegacyDecoration: true });

/**
 * Admits the additional content locales. `ADDITIONAL_CONTENT_LOCALES` wins
 * whenever it is present, even empty; the deprecated `AVAILABLE_LOCALES` is
 * read only when it is absent. The result is canonicalised and de-duplicated;
 * the primary locale is not filtered here, because the frontend owns it.
 */
export const admitContentLocales = (
  additional: unknown,
  legacy: unknown,
): string[] | undefined => {
  const codes = readNewList(additional) ?? readLegacyList(legacy);
  return codes === undefined ? undefined : canonicalizeContentLocales(codes);
};

/** Whether only the deprecated `AVAILABLE_LOCALES` supplies the locales. */
export const isLegacyContentLocalesInEffect = (
  additional: unknown,
  legacy: unknown,
): boolean =>
  readNewList(additional) === undefined && readLegacyList(legacy) !== undefined;
