import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/*
 * Every resource kind this validator recognises already carries its owning
 * bucket as part of the DIAL Core resource path itself
 * (`applications/{bucket}/{path}`, `conversations/{bucket}/{path}`,
 * `prompts/{bucket}/{path}`, ...), so this is how the discard, revoke, and
 * recipients-count endpoints recognise a well-formed itemId for those kinds.
 */
const CATALOG_RESOURCE_PATH_PATTERN =
  /^(?:applications|toolsets|conversations|skills|prompts)\/[^/\s]+\/[^/\r\n][^\r\n]*(?![\s\S])/;

/** Validates `itemId` against `CATALOG_RESOURCE_PATH_PATTERN`. */
export const IsCatalogResourcePath = (
  validationOptions?: ValidationOptions,
) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCatalogResourcePath',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          return (
            typeof value === 'string' &&
            CATALOG_RESOURCE_PATH_PATTERN.test(value)
          );
        },
        defaultMessage() {
          return 'itemId must identify an application, toolset, skill, conversation, or prompt resource with a bucket and item path';
        },
      },
    });
  };
};
