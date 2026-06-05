import { registerDecorator, ValidationOptions } from 'class-validator';

const FORBIDDEN_PATH_CHARS = /[:;,={}&\\"]/;
const INVALID_PERCENT_ENCODING = /%(?![0-9a-fA-F]{2})/;
const ENCODED_PATH_SEPARATOR_OR_DOT = /%(?:2e|2f|5c)/i;

export const IsValidFilePath = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isValidFilePath',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          if (value.startsWith('/')) return false;
          if (value.includes('..')) return false;
          if (FORBIDDEN_PATH_CHARS.test(value)) return false;
          if (INVALID_PERCENT_ENCODING.test(value)) return false;
          if (ENCODED_PATH_SEPARATOR_OR_DOT.test(value)) return false;
          return true;
        },
        defaultMessage() {
          return 'path must not start with /, contain .., or include forbidden characters';
        },
      },
    });
  };
};
