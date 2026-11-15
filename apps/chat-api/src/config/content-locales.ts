import {
  registerDecorator,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from 'class-validator';

/** Characters an additional content locale code may contain. */
export const CONTENT_LOCALE_PATTERN = /^[A-Za-z0-9-]+$/;

/** Longest additional content locale code accepted at boot. */
export const CONTENT_LOCALE_MAX_LENGTH = 35;

/* Legacy 0.x `AVAILABLE_LOCALES` values were written as JSON-ish lists (`["ar","en"]`). */
const LEGACY_LIST_DECORATION = /[[\]'"]/g;

/**
 * Splits a comma-separated locale list from the environment. An absent value
 * stays `undefined` (so a fallback can apply), an empty one becomes `[]`.
 * Codes are only trimmed here — validation reports what the operator typed,
 * and canonicalisation happens when the config key is resolved.
 */
export const parseContentLocaleList = (
  value: unknown,
  { stripLegacyDecoration = false }: { stripLegacyDecoration?: boolean } = {},
): string[] | undefined => {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value as string[];
  const raw = stripLegacyDecoration
    ? String(value).replace(LEGACY_LIST_DECORATION, '')
    : String(value);
  return raw
    .split(',')
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
};

/** Whether `value` is a well-formed BCP-47 language tag. */
export const isBcp47Locale = (value: unknown): boolean => {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    Intl.getCanonicalLocales(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Canonicalises (`de-de` → `de-DE`) and de-duplicates a validated locale list,
 * keeping each code's first occurrence.
 */
export const canonicalizeContentLocales = (codes: string[]): string[] => {
  const result: string[] = [];
  for (const code of codes) {
    const [canonical] = Intl.getCanonicalLocales(code);
    if (canonical && !result.includes(canonical)) {
      result.push(canonical);
    }
  }
  return result;
};

@ValidatorConstraint({ name: 'isBcp47Locale', async: false })
class IsBcp47LocaleConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return Array.isArray(value)
      ? value.every((code) => isBcp47Locale(code))
      : isBcp47Locale(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a comma-separated list of BCP-47 language tags (e.g. de,fr-FR,pt-BR)`;
  }
}

/** Rejects any entry that `Intl.getCanonicalLocales` cannot parse. */
export const IsBcp47LocaleList =
  (validationOptions?: ValidationOptions): PropertyDecorator =>
  (target: object, propertyName: string | symbol) => {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: IsBcp47LocaleConstraint,
    });
  };
