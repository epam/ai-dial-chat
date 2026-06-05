import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvironmentVariables } from './environment.config';

export const validate = (config: Record<string, unknown>) => {
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
