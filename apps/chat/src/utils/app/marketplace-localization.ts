import { LocalesService } from '@/src/utils/app/data/locales-service';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { DEFAULT_LOCAL } from '@/src/constants/locale';

import uniq from 'lodash-es/uniq';

export const parseLocalizedField = (
  locale: string,
  field?: string | Record<string, string>,
  strict = false,
): string => {
  const primaryLocale = LocalesService.getPrimaryLocale();

  if (typeof field === 'string') {
    if (strict) {
      return locale === primaryLocale ? field : '';
    }
    return field;
  }

  if (strict) {
    return field?.[locale] ?? '';
  }

  return (
    field?.[locale] ?? field?.[primaryLocale] ?? field?.[DEFAULT_LOCAL] ?? ''
  );
};

/**
 * Locale-aware comparator for localized entity names, for sorting lists that
 * are *displayed* in the current locale. Uses `localeCompare` so non-ASCII
 * alphabets order correctly for the active locale.
 */
export const compareLocalizedNames = (
  locale: string,
  a?: string | Record<string, string>,
  b?: string | Record<string, string>,
): number =>
  parseLocalizedField(locale, a).localeCompare(
    parseLocalizedField(locale, b),
    locale,
    { sensitivity: 'base' },
  );

export const getLocalizedEntityIdName = (
  name?: string | Record<string, string>,
): string => {
  if (typeof name === 'string') return name;

  return name?.[LocalesService.getPrimaryLocale()] ?? '';
};

export const updateLocalizedEntityIdName = (
  entity: { name: string | Record<string, string> },
  newName: string,
) => {
  const primaryLocale = LocalesService.getPrimaryLocale();

  if (typeof entity.name === 'string') return { ...entity, name: newName };
  else if (typeof entity.name?.[primaryLocale] === 'string') {
    const updatedLocalizedName = {
      ...entity.name,
      [primaryLocale]: newName,
    };

    return { ...entity, name: updatedLocalizedName };
  }

  return entity;
};

/**
 * Returns a copy of the entity whose `name` is resolved to the identifier
 * (primary locale) value. Use at boundaries where the entity is treated as a
 * plain share/publish resource with a string `name`.
 */
export const withEntityIdName = <
  T extends { name?: string | Record<string, string> },
>(
  entity: T,
): Omit<T, 'name'> & { name: string } => ({
  ...entity,
  name: getLocalizedEntityIdName(entity.name),
});

export const getEntityLocals = (
  entity?: MarketplaceEntity,
  excludePrimary = false,
): { locale: string; name: string; description: string }[] => {
  if (!entity) return [];

  const primaryLocale = LocalesService.getPrimaryLocale();

  const nameLocals =
    typeof entity.name === 'string'
      ? [primaryLocale]
      : Object.keys(entity.name);
  const descriptionLocals =
    typeof entity.description === 'string'
      ? [primaryLocale]
      : Object.keys(entity.description ?? {});
  let locals = uniq([...nameLocals, ...descriptionLocals]);

  if (excludePrimary)
    locals = locals.filter((locale) => locale !== primaryLocale);

  return locals.map((locale) => ({
    locale,
    name: parseLocalizedField(locale, entity.name, true),
    description: parseLocalizedField(locale, entity.description, true),
  }));
};

export const getEntityPayloadFromLocals = (
  locals: { locale: string; name: string; description: string }[],
): { name: Record<string, string>; description: Record<string, string> } => {
  return locals.reduce<{
    name: Record<string, string>;
    description: Record<string, string>;
  }>(
    (acc, { locale, name, description }) => {
      if (name) {
        acc.name[locale] = name;
      }
      if (description) {
        acc.description[locale] = description;
      }
      return acc;
    },
    { name: {}, description: {} },
  );
};
