import { CHAT_APP_ID } from '../../config/env/app-ids';

/** The Config Studio application id of every Chat runner instance. */
export const MANAGED_CONFIG_APP_ID = CHAT_APP_ID;

/**
 * The version of the managed contract this build generates. It is the
 * contract's own semantic version, independent of Chat's release version.
 */
export const MANAGED_CONFIG_SCHEMA_VERSION = '1.3.0';

/**
 * The exact schema versions this build accepts. A future reader accepts a
 * snapshot only for a listed version whose `schemaSha256` matches.
 */
export const SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS: readonly string[] = [
  '1.0.0',
  '1.1.0',
  '1.2.0',
  '1.3.0',
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
  '1.0.0': 'edbe9267f6663eb7768ae7e2033e20b0b3c842994224a774968d348e3b9be71f',
  '1.1.0': 'd1b5d59e7fbefad252109ef504d1ff9955403d94b84be937beb7da1b895113df',
  '1.2.0': '5761c06c65b9846e965b02074f7291e92d651ffff074c6ad7653b25376fef2e1',
  '1.3.0': 'cf11cb878aeedfbfdb4b8d38254dabe1542de7a0abfab1cf8817800d128c4a41',
};

/** Config Studio's limit on the canonical bytes of an uploaded schema (56 KiB). */
export const MAX_MANAGED_SCHEMA_BYTES = 57_344;

/** Config Studio's limit on the canonical bytes of a published payload (56 KiB). */
export const MAX_MANAGED_PAYLOAD_BYTES = 57_344;

/**
 * Managed keys that build one client-config object and so are managed in the
 * same schema version and activated together: a partial group would merge a
 * published value with environment values the editor cannot see.
 */
export const MANAGED_KEY_GROUPS: readonly (readonly string[])[] = [
  [
    'ui.celebrationDelivery.mode',
    'ui.celebrationDelivery.revision',
    'ui.celebrationDelivery.externalScenes',
    'ui.celebrationDelivery.externalEvents',
  ],
];
