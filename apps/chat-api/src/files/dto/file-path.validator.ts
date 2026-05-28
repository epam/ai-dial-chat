import { registerDecorator, ValidationOptions } from 'class-validator';

const FORBIDDEN_PATH_CHARS = /[:;,={}%&\\"]/;

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
          return true;
        },
        defaultMessage() {
          return 'path must not start with /, contain .., or include forbidden characters';
        },
      },
    });
  };
};
