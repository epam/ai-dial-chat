import { DEFAULT_LOCAL } from '@/src/constants/locale';

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
