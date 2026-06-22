import type { EnvironmentVariables } from '../config/environment.config';

export type ConfigValueType = boolean | string | number | unknown;

export interface ConfigDefinition {
  key: string;
  type: 'feature' | 'config';
  valueType: 'boolean' | 'string' | 'number' | 'json';
  visibility: 'client' | 'server';
  defaultValue: unknown;
  critical: boolean;
  description: string;
  owner: string;
  envVar?: keyof EnvironmentVariables;
  /** Env var holding a comma-separated list of allowed roles. Only valid for type='feature'.
   *  When set and non-empty, the feature is restricted to users whose roles include at least one
   *  entry. When absent or empty, the feature is unrestricted (visible to all). */
  allowedRolesEnvVar?: keyof EnvironmentVariables;
  expiresAt?: string;
}

export interface AppConfigEvalContext {
  appId: string;
  userId?: string;
  roles?: string[];
  environment?: string;
}

export interface ConfigProvider {
  resolve(
    key: string,
    context: AppConfigEvalContext,
  ): Promise<unknown | undefined>;
}
