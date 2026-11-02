import {
  CATALOG_CREATION_TYPES,
  type CatalogCreationRolesConfig,
  type CatalogCreationType,
} from '../config/catalog-creation.types';

/**
 * `CATALOG_CREATION_ROLES` after startup normalization: only rules that
 * restrict anything, each holding trimmed, deduplicated role names.
 */
export interface CatalogCreationPolicy {
  readonly types: ReadonlyMap<CatalogCreationType, ReadonlySet<string>>;
  /** Exact schema ids in configuration order. */
  readonly schemas: ReadonlyMap<string, ReadonlySet<string>>;
}

/** One user's creation permissions, as client-config reports them. */
export interface CatalogCreationPermissions {
  allowedTypes: CatalogCreationType[];
  restrictedSchemaIds: string[];
}

/* Trimmed, non-blank roles in first-occurrence order; the Set drops duplicates. */
const normalizeRoles = (roles: readonly string[]): ReadonlySet<string> =>
  new Set(roles.map((role) => role.trim()).filter((role) => role !== ''));

/**
 * Normalizes a validated `CATALOG_CREATION_ROLES` value once, at startup.
 *
 * A rule whose role list is empty after trimming imposes no restriction and is
 * dropped; all such rules are reported in a single warning that names type
 * keys only — never role names or schema ids. Schema ids are kept exactly as
 * configured. Takes a `warn` callback for the same reason as
 * `normalizeEnabledUiFeatures`, and never mutates its input.
 */
export const normalizeCatalogCreationPolicy = (
  config: CatalogCreationRolesConfig | undefined,
  warn: (message: string) => void,
): CatalogCreationPolicy => {
  const types = new Map<CatalogCreationType, ReadonlySet<string>>();
  const schemas = new Map<string, ReadonlySet<string>>();
  const emptyTypes: CatalogCreationType[] = [];
  let emptySchemaRules = 0;

  for (const type of CATALOG_CREATION_TYPES) {
    const roles = config?.types?.[type];
    if (roles === undefined) {
      continue;
    }
    const normalized = normalizeRoles(roles);
    if (normalized.size > 0) {
      types.set(type, normalized);
    } else {
      emptyTypes.push(type);
    }
  }

  for (const [schemaId, roles] of Object.entries(config?.schemas ?? {})) {
    const normalized = normalizeRoles(roles);
    if (normalized.size > 0) {
      schemas.set(schemaId, normalized);
    } else {
      emptySchemaRules += 1;
    }
  }

  if (emptyTypes.length > 0 || emptySchemaRules > 0) {
    const parts = [
      emptyTypes.length > 0 ? `types ${emptyTypes.join(', ')}` : null,
      emptySchemaRules > 0 ? `${emptySchemaRules} schema rule(s)` : null,
    ].filter((part): part is string => part !== null);
    warn(
      `CATALOG_CREATION_ROLES has empty role lists for ${parts.join(' and ')}; those rules impose no restriction`,
    );
  }

  return { types, schemas };
};

const isSatisfied = (
  required: ReadonlySet<string> | undefined,
  roles: ReadonlySet<string>,
): boolean =>
  required === undefined || [...required].some((role) => roles.has(role));

/**
 * Evaluates the policy for one user. A rule passes when the user holds any of
 * its roles; a missing rule passes. There is no administrator exception.
 * Schema denials are reported independently of the broad `schema-app` type,
 * which the client composes with them.
 */
export const evaluateCatalogCreationPolicy = (
  policy: CatalogCreationPolicy,
  roles: readonly string[] | undefined,
): CatalogCreationPermissions => {
  const userRoles = new Set(roles ?? []);

  return {
    allowedTypes: CATALOG_CREATION_TYPES.filter((type) =>
      isSatisfied(policy.types.get(type), userRoles),
    ),
    restrictedSchemaIds: [...policy.schemas]
      .filter(([, required]) => !isSatisfied(required, userRoles))
      .map(([schemaId]) => schemaId),
  };
};
