import type { EnvironmentVariables } from '../config/environment.config';
import type { KeyManagement } from './managed-config/managed-config.types';

/** The environment variables whose validated value is a list of strings. */
export type StringListEnvironmentVariable = {
  [Name in keyof EnvironmentVariables]-?: EnvironmentVariables[Name] extends
    string[] | undefined
    ? Name
    : never;
}[keyof EnvironmentVariables];

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
  allowedRolesEnvVar?: StringListEnvironmentVariable;
  expiresAt?: string;
  /**
   * The key's place in the exported Config Studio contract: managed, with
   * what it exports, or local-only, with the reason. Absent means eligible
   * but unmanaged. Exporting is not activation: no value is read from a
   * managed source because of it.
   */
  management?: KeyManagement;
}

export interface AppConfigEvalContext {
  appId: string;
  userId?: string;
  roles?: string[];
}

export interface ConfigProvider {
  resolve(
    key: string,
    context: AppConfigEvalContext,
  ): Promise<unknown | undefined>;
}
