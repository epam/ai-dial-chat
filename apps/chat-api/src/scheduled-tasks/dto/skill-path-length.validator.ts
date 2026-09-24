import { maxLength, registerDecorator } from 'class-validator';

/** Measures the resource path independently of its wire encoding. */
export const IsValidSkillPathLength = () => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isValidSkillPathLength',
      target: object.constructor,
      propertyName,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const path = value.split('/').slice(2).join('/');
          try {
            return maxLength(decodeURIComponent(path), 1024);
          } catch {
            return false;
          }
        },
        defaultMessage() {
          return 'skillUrl path must not exceed 1024 decoded characters';
        },
      },
    });
  };
};
