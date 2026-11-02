import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/*
 * class-validator's `MaxLength` counts UTF-16 code units, so an emoji costs
 * two. Text that the refinement API bounds in Unicode code points (see
 * `TEXT_REFINEMENT_LIMITS`) must be bounded the same way when it is saved,
 * or a refined draft at the limit could fail to save.
 */
export const hasAtMostCodePoints = (value: unknown, max: number): boolean =>
  typeof value === 'string' && [...value].length <= max;

/** Rejects a string longer than `max` Unicode code points. */
export const MaxCodePoints = (
  max: number,
  validationOptions?: ValidationOptions,
) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'maxCodePoints',
      target: object.constructor,
      propertyName,
      constraints: [max],
      options: validationOptions,
      validator: {
        validate: (value: unknown) => hasAtMostCodePoints(value, max),
        defaultMessage(args?: ValidationArguments) {
          return `${args?.property ?? propertyName} must be a string of at most ${max} characters`;
        },
      },
    });
  };
};
