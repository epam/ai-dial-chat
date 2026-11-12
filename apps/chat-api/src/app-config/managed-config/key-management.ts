import type { ConfigDefinition } from '../app-config.types';
import {
  KeyManagementKind,
  type LocalOnlyKey,
  type LocalOnlyReason,
  type ManagedConfigKey,
  type ManagedConfigKeyContract,
  type ManagedFeatureKey,
  type ManagedKeyAnnotations,
} from './managed-config.types';

/** Exports a config key with its value schema. */
export const managedConfigKey = (
  contract: ManagedConfigKeyContract,
): ManagedConfigKey => ({ kind: KeyManagementKind.ManagedConfig, contract });

/** Exports a feature; its value is always the shared feature state. */
export const managedFeatureKey = (
  contract: ManagedKeyAnnotations,
): ManagedFeatureKey => ({ kind: KeyManagementKind.ManagedFeature, contract });

/** Keeps a key local for `reason`; it is never exported. */
export const localOnlyKey = (reason: LocalOnlyReason): LocalOnlyKey => ({
  kind: KeyManagementKind.LocalOnly,
  reason,
});

/** The classification of a managed key, or `undefined` for any other key. */
export const managedKeyOf = (
  definition: Pick<ConfigDefinition, 'management'>,
): ManagedConfigKey | ManagedFeatureKey | undefined => {
  const { management } = definition;
  return management?.kind === KeyManagementKind.ManagedConfig ||
    management?.kind === KeyManagementKind.ManagedFeature
    ? management
    : undefined;
};

/** Whether the key is part of the exported Config Studio contract. */
export const isManagedKey = (
  definition: Pick<ConfigDefinition, 'management'>,
): boolean => managedKeyOf(definition) !== undefined;

/** Why the key can never be managed, or `undefined` when it can. */
export const localOnlyReasonOf = (
  definition: Pick<ConfigDefinition, 'management'>,
): LocalOnlyReason | undefined =>
  definition.management?.kind === KeyManagementKind.LocalOnly
    ? definition.management.reason
    : undefined;
