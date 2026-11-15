import type { ConfigDefinition } from '../app-config.types';
import { canonicalByteLength, canonicalSha256 } from './canonical-json';
import {
  buildManagedConfigSchema,
  type JsonSchemaObject,
} from './managed-config-schema';
import {
  MANAGED_CONFIG_APP_ID,
  SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS,
} from './managed-config.constants';

/** The format id of `index.json`. */
export const MANAGED_CONFIG_INDEX_FORMAT = 'dial-managed-config-schema-index@1';

/** `MAJOR.MINOR.PATCH`, each at most six digits without leading zeros. */
export const SCHEMA_VERSION_PATTERN =
  /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/;

/**
 * One committed schema version: exactly Config Studio's schema upload body
 * without the client-supplied `operationId`.
 */
export interface ManagedConfigArtifact {
  readonly appId: string;
  readonly schemaVersion: string;
  readonly schema: JsonSchemaObject;
}

/** One `index.json` entry. */
export interface ManagedConfigIndexEntry {
  readonly schemaVersion: string;
  /** The artifact's file name in the same directory. */
  readonly file: string;
  /** Lowercase hex SHA-256 of the canonical `schema`, as Studio reports it. */
  readonly schemaSha256: string;
  /** UTF-8 byte length of the canonical `schema`. */
  readonly canonicalBytes: number;
}

/** `index.json`: the committed versions and the versions this build accepts. */
export interface ManagedConfigIndex {
  readonly format: string;
  readonly appId: string;
  /** The highest committed version. */
  readonly current: string;
  /** The versions this build accepts, `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS`. */
  readonly supported: readonly string[];
  /** Every committed version, ascending. */
  readonly versions: readonly ManagedConfigIndexEntry[];
}

/** Parses a schema version into its numeric components. */
export const parseSchemaVersion = (
  version: string,
): readonly [number, number, number] => {
  const match = SCHEMA_VERSION_PATTERN.exec(version);
  if (!match) {
    throw new TypeError(`Invalid schema version: ${version}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

/** Orders schema versions by semantic version, ascending. */
export const compareSchemaVersions = (left: string, right: string): number => {
  const a = parseSchemaVersion(left);
  const b = parseSchemaVersion(right);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
};

/** The committed file name of a schema version. */
export const managedConfigArtifactFileName = (schemaVersion: string): string =>
  `${MANAGED_CONFIG_APP_ID}-${schemaVersion}.json`;

/** Builds the artifact of `schemaVersion` from the registry. */
export const buildManagedConfigArtifact = (
  definitions: readonly ConfigDefinition[],
  schemaVersion: string,
): ManagedConfigArtifact => {
  parseSchemaVersion(schemaVersion);
  return {
    appId: MANAGED_CONFIG_APP_ID,
    schemaVersion,
    schema: buildManagedConfigSchema(definitions, schemaVersion),
  };
};

/**
 * Builds `index.json` from every committed artifact. It is derived only from
 * the artifacts and constants, so regenerating it is deterministic.
 */
export const buildManagedConfigIndex = (
  artifacts: readonly ManagedConfigArtifact[],
): ManagedConfigIndex => {
  if (artifacts.length === 0) {
    throw new TypeError('An index needs at least one schema version');
  }
  const sorted = [...artifacts].sort((left, right) =>
    compareSchemaVersions(left.schemaVersion, right.schemaVersion),
  );
  return {
    format: MANAGED_CONFIG_INDEX_FORMAT,
    appId: MANAGED_CONFIG_APP_ID,
    current: sorted[sorted.length - 1].schemaVersion,
    supported: [...SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS],
    versions: sorted.map((artifact) => ({
      schemaVersion: artifact.schemaVersion,
      file: managedConfigArtifactFileName(artifact.schemaVersion),
      schemaSha256: canonicalSha256(artifact.schema),
      canonicalBytes: canonicalByteLength(artifact.schema),
    })),
  };
};
