import { MarketplaceEntity } from '@/src/types/marketplace';

import { DEFAULT_LOCAL } from '@/src/constants/locale';

import uniq from 'lodash-es/uniq';

export const parseLocalizedField = (
  locale: string,
  field?: string | Record<string, string>,
  strict = false,
): string => {
  if (typeof field === 'string') {
    if (strict) {
      return locale === DEFAULT_LOCAL ? field : '';
    }
    return field;
  }

  return field?.[locale] ?? (strict ? '' : field?.[DEFAULT_LOCAL]) ?? '';
};

export const getLocalizedEntityIdName = (
  name?: string | Record<string, string>,
): string => {
  if (typeof name === 'string') return name;

  return name?.[DEFAULT_LOCAL] ?? '';
};

export const updateLocalizedEntityIdName = (
  entity: { name: string | Record<string, string> },
  newName: string,
) => {
  if (typeof entity.name === 'string') return { ...entity, name: newName };
  else if (typeof entity.name?.[DEFAULT_LOCAL] === 'string') {
    const updatedLocalizedName = {
      ...entity.name,
      [DEFAULT_LOCAL]: newName,
    };

    return { ...entity, name: updatedLocalizedName };
  }

  return entity;
};

/**
 * Returns a copy of the entity whose `name` is resolved to the identifier
 * (`en`) value. Use at boundaries where the entity is treated as a plain
 * share/publish resource with a string `name`.
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
  excludeDefault = false,
): { locale: string; name: string; description: string }[] => {
  if (!entity) return [];

  const nameLocals =
    typeof entity.name === 'string'
      ? [DEFAULT_LOCAL]
      : Object.keys(entity.name);
  const descriptionLocals =
    typeof entity.description === 'string'
      ? [DEFAULT_LOCAL]
      : Object.keys(entity.description ?? {});
  let locals = uniq([...nameLocals, ...descriptionLocals]);

  if (excludeDefault)
    locals = locals.filter((locale) => locale !== DEFAULT_LOCAL);

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
