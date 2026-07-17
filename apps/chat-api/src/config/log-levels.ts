import type { LogLevel } from '@nestjs/common';
import { ApplicationLogLevel } from './environment.config';

const enabledLogLevels: Record<ApplicationLogLevel, LogLevel[]> = {
  [ApplicationLogLevel.Debug]: ['log', 'error', 'warn', 'debug'],
  [ApplicationLogLevel.Log]: ['log', 'error', 'warn'],
  [ApplicationLogLevel.Warn]: ['error', 'warn'],
  [ApplicationLogLevel.Error]: ['error'],
};

const isApplicationLogLevel = (
  value: string | undefined,
): value is ApplicationLogLevel =>
  Object.values(ApplicationLogLevel).some((level) => level === value);

export const resolveLogLevels = (
  nodeEnvironment: string | undefined,
  configuredLogLevel: string | undefined,
): LogLevel[] => {
  const defaultLogLevel =
    nodeEnvironment === 'production'
      ? ApplicationLogLevel.Log
      : ApplicationLogLevel.Debug;
  const logLevel = isApplicationLogLevel(configuredLogLevel)
    ? configuredLogLevel
    : defaultLogLevel;

  return enabledLogLevels[logLevel];
};
