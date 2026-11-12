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

/**
 * The canonical `schemaSha256` of every committed schema version, edited by
 * hand and never by the generator. A pinned version is frozen: the generator
 * refuses to change its hash, and the artifact test fails when a committed
 * file or `index.json` disagrees with its pin. A contract change, annotations
 * included, is a new version with its own pin.
 */
export const PINNED_MANAGED_CONFIG_SCHEMA_SHA256: Readonly<
  Record<string, string>
> = {
  '1.0.0': '9e2155b7857adf6cc51e8966ad02ebf79953c5a87875eaea929e384c02b55dd6',
};

/** Config Studio's limit on the canonical bytes of an uploaded schema (56 KiB). */
export const MAX_MANAGED_SCHEMA_BYTES = 57_344;

/** Config Studio's limit on the canonical bytes of a published payload (56 KiB). */
export const MAX_MANAGED_PAYLOAD_BYTES = 57_344;
