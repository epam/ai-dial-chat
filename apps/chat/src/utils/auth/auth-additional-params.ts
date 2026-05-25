import { logger } from '@/src/utils/server/logger';

import { safeParseJSON } from '../json';

type AuthAdditionalParamValue = string | number | boolean;
type AuthAdditionalParamEntry = Record<string, AuthAdditionalParamValue>;

const AUTH_ADDITIONAL_PARAMS_PARSE_ERROR =
  'Error when parsing AUTH_ADDITIONAL_PARAMS';

const isAuthAdditionalParamValue = (
  value: unknown,
): value is AuthAdditionalParamValue =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

export const getAuthAdditionalParamsExchangeBody = () => {
  const rawValue = process.env.AUTH_ADDITIONAL_PARAMS?.replaceAll('\\"', '"');
  if (!rawValue) {
    return undefined;
  }

  let parsedValue: unknown;
  try {
    parsedValue = safeParseJSON(
      rawValue,
      AUTH_ADDITIONAL_PARAMS_PARSE_ERROR,
      logger,
    );
  } catch {
    return undefined;
  }

  if (!Array.isArray(parsedValue)) {
    logger.warn(
      'AUTH_ADDITIONAL_PARAMS must be a JSON array of key/value objects',
    );
    return undefined;
  }

  const exchangeBody = parsedValue.reduce<Record<string, string>>(
    (params, entry, entryIndex) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        logger.warn(
          `AUTH_ADDITIONAL_PARAMS entry at index ${entryIndex} must be an object`,
        );
        return params;
      }

      Object.entries(entry as AuthAdditionalParamEntry).forEach(
        ([key, value]) => {
          if (!key) {
            logger.warn(
              `AUTH_ADDITIONAL_PARAMS entry at index ${entryIndex} contains an empty key`,
            );
            return;
          }

          if (!isAuthAdditionalParamValue(value)) {
            logger.warn(
              `AUTH_ADDITIONAL_PARAMS value for key "${key}" must be a string, number, or boolean`,
            );
            return;
          }

          params[key] = String(value);
        },
      );

      return params;
    },
    {},
  );

  return Object.keys(exchangeBody).length ? exchangeBody : undefined;
};
