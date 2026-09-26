import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvironmentVariables } from './environment.config';

/*
 * Falls back a config key to AUTH_CALLBACK_BASE_URL when it is unset or
 * empty. Done here, on the raw plain object, rather than via a class-level
 * `@Transform` on the target fields: class-transformer only invokes a
 * property's `@Transform` when that key is present in the source object, so
 * it cannot supply a default sourced from a sibling field for a key that is
 * absent entirely (see AUTH_POST_LOGOUT_REDIRECT_URI / CORS_ORIGIN in
 * environment.config.ts, whose defaults derive from AUTH_CALLBACK_BASE_URL).
 */
const withCallbackBaseUrlFallback = (
  config: Record<string, unknown>,
  key: string,
): Record<string, unknown> => {
  const raw = config[key];
  if (raw != null && raw !== '') return config;
  return { ...config, [key]: config['AUTH_CALLBACK_BASE_URL'] };
};

export const validate = (rawConfig: Record<string, unknown>) => {
  const config = withCallbackBaseUrlFallback(
    withCallbackBaseUrlFallback(rawConfig, 'CORS_ORIGIN'),
    'AUTH_POST_LOGOUT_REDIRECT_URI',
  );

  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors
        .map((error) => Object.values(error.constraints || {}).join(', '))
        .join('\n')}`,
    );
  }

  console.info(
    '[Config] Environment validated. DIAL_CORE_URL=%s',
    validatedConfig.DIAL_CORE_URL,
  );

  return validatedConfig;
};
