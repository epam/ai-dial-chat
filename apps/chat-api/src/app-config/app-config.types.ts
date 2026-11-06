import type { EnvironmentVariables } from '../config/environment.config';
import type {
  LocalOnlyReason,
  ManagedKeyContract,
} from './managed-config/managed-config.types';

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
  /**
   * Whether the key is part of the exported Config Studio contract. Defaults
   * to `false`. Exporting is not activation: no value is read from a managed
   * source because of this flag. Mutually exclusive with `localOnly`.
   */
  managed?: boolean;
  /** Why the key can never be managed; it is then never exported. */
  localOnly?: LocalOnlyReason;
  /** What a managed key exports; required when `managed` is `true`. */
  managedContract?: ManagedKeyContract;
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
