/** The Config Studio application id of every Chat runner instance. */
export const MANAGED_CONFIG_APP_ID = 'chat-ui';

/**
 * The version of the managed contract this build generates. It is the
 * contract's own semantic version, independent of Chat's release version.
 */
export const MANAGED_CONFIG_SCHEMA_VERSION = '1.0.0';

/**
 * The exact schema versions this build accepts. A future reader accepts a
 * snapshot only for a listed version whose `schemaSha256` matches.
 */
export const SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS: readonly string[] = [
  '1.0.0',
];

/** Config Studio's limit on the canonical bytes of an uploaded schema (56 KiB). */
export const MAX_MANAGED_SCHEMA_BYTES = 57_344;

/** Config Studio's limit on the canonical bytes of a published payload (56 KiB). */
export const MAX_MANAGED_PAYLOAD_BYTES = 57_344;
