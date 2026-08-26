import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

const getDepth = (value: unknown): number => {
  if (value === null || typeof value !== 'object') {
    return 0;
  }

  const values = Array.isArray(value) ? value : Object.values(value);

  return 1 + values.reduce((max, item) => Math.max(max, getDepth(item)), 0);
};

const countKeys = (value: unknown): number => {
  if (value === null || typeof value !== 'object') {
    return 0;
  }

  const values = Array.isArray(value) ? value : Object.values(value);
  const ownKeys = Array.isArray(value) ? 0 : Object.keys(value).length;

  return ownKeys + values.reduce((sum, item) => sum + countKeys(item), 0);
};

/**
 * Bounds a `Record<string, unknown>` field's nesting depth and total key
 * count, so an arbitrarily deep/wide payload (e.g. `form_schema`) can't cause
 * memory pressure or stack overflow during serialization/deserialization
 * before the HTTP body size limit would ever trigger.
 */
export const IsShallowObject = (
  options: { maxDepth: number; maxKeys: number },
  validationOptions?: ValidationOptions,
) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isShallowObject',
      target: object.constructor,
      propertyName,
      constraints: [options.maxDepth, options.maxKeys],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || typeof value !== 'object') {
            return true;
          }

          return (
            getDepth(value) <= options.maxDepth &&
            countKeys(value) <= options.maxKeys
          );
        },
        defaultMessage({ constraints, property }: ValidationArguments) {
          return `${property} must not be nested deeper than ${constraints[0]} levels or contain more than ${constraints[1]} keys`;
        },
      },
    });
  };
};
