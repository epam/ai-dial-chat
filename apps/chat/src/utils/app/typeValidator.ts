import { isArray, isBoolean, isNumber, isObject, isString } from 'lodash';

type Validator = (v: unknown) => boolean;

export class TypeValidator {
  static number() {
    return (v: unknown) => isNumber(v);
  }

  static string() {
    return (v: unknown) => isString(v);
  }

  static boolean() {
    return (v: unknown) => isBoolean(v);
  }

  static array(childType: Validator) {
    return (v: unknown) => isArray(v) && v.every(childType);
  }

  static oneOf(options: unknown[]) {
    return (v: unknown) => options.includes(v);
  }

  static shape(shapeType: Record<string, Validator>) {
    return (v: unknown) =>
      isObject(v) &&
      Object.entries(shapeType).every(([key, validator]) =>
        validator((v as Record<string, unknown>)[key]),
      );
  }

  static map(keyValidator: Validator, valueValidator: Validator) {
    return (v: unknown) =>
      isObject(v) &&
      Object.entries(v).every(
        ([key, value]) => keyValidator(key) && valueValidator(value),
      );
  }

  static optional(validator: Validator) {
    return (v: unknown) => v === undefined || v === null || validator(v);
  }
}
