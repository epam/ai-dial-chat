import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvironmentVariables } from './environment.config';

const logger = new Logger('Bootstrap');

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

  if (!validatedConfig.MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS?.length) {
    logger.warn(
      'MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS is not set — every request will be rejected with 403 until it is configured.',
    );
  }

  return validatedConfig;
};
