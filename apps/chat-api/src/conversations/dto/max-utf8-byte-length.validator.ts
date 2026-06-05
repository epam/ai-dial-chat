import { registerDecorator, type ValidationOptions } from 'class-validator';
import { StringUtils } from '../../common/utils/string-utils.js';

export const MaxUtf8ByteLength = (
  max: number,
  validationOptions?: ValidationOptions,
) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'maxUtf8ByteLength',
      target: object.constructor,
      propertyName,
      constraints: [max],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return (
            typeof value === 'string' &&
            StringUtils.getUtf8ByteLength(value) <= max
          );
        },
        defaultMessage({ constraints, property }) {
          return `${property} must be at most ${constraints[0]} bytes in UTF-8 encoding`;
        },
      },
    });
  };
};
