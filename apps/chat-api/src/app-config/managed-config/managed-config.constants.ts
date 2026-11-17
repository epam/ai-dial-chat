import { CHAT_APP_ID } from '../../config/env/app-ids';

/** The Config Studio application id of every Chat runner instance. */
export const MANAGED_CONFIG_APP_ID = CHAT_APP_ID;

/**
 * The version of the managed contract this build generates. It is the
 * contract's own semantic version, independent of Chat's release version.
 */
export const MANAGED_CONFIG_SCHEMA_VERSION = '1.1.0';

/**
 * The exact schema versions this build accepts. A future reader accepts a
 * snapshot only for a listed version whose `schemaSha256` matches.
 */
export const SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS: readonly string[] = [
  '1.0.0',
  '1.1.0',
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
  '1.0.0': 'c1e565ff7edc923cd2eb03afc70cbbb4872d9d270d3440485ed5ef42fe78fb1a',
  '1.1.0': 'caa5bc8e5216d5189894f50bc037808a2f2ec4474d0f87219f724197a5e371af',
};

/** Config Studio's limit on the canonical bytes of an uploaded schema (56 KiB). */
export const MAX_MANAGED_SCHEMA_BYTES = 57_344;

/** Config Studio's limit on the canonical bytes of a published payload (56 KiB). */
export const MAX_MANAGED_PAYLOAD_BYTES = 57_344;
