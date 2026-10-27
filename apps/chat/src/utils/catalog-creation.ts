import {
  CatalogCreationType,
  type CatalogCreationPermissionsDto,
} from '@epam/ai-dial-chat-api-client';
import type { UserProfile } from '@epam/ai-dial-chat-shared';

/** Every creation type, in the order client-config reports them. */
export const CATALOG_CREATION_TYPES: readonly CatalogCreationType[] =
  Object.values(CatalogCreationType);

const KNOWN_CREATION_TYPES = new Set<string>(CATALOG_CREATION_TYPES);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

/**
 * Reads `config.catalogCreationPermissions` from a successful client-config
 * response.
 *
 * An absent field is an older backend that has no creation policy: every type
 * is allowed and no schema is restricted. A present value that is not the
 * documented object returns `null` — creation is then unavailable, never
 * unrestricted. Unknown type values are ignored, as they name nothing the
 * client can create.
 */
export const parseCatalogCreationPermissions = (
  value: unknown,
): CatalogCreationPermissionsDto | null => {
  if (value === undefined) {
    return {
      allowedTypes: [...CATALOG_CREATION_TYPES],
      restrictedSchemaIds: [],
    };
  }
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const { allowedTypes, restrictedSchemaIds } = value as Record<
    string,
    unknown
  >;
  if (!isStringArray(allowedTypes) || !isStringArray(restrictedSchemaIds)) {
    return null;
  }
  return {
    allowedTypes: allowedTypes.filter((type): type is CatalogCreationType =>
      KNOWN_CREATION_TYPES.has(type),
    ),
    restrictedSchemaIds: [...restrictedSchemaIds],
  };
};

/* Anonymous callers share one identity; `\n` cannot occur in either part. */
const ANONYMOUS_IDENTITY = 'anonymous';

/**
 * The identity creation permissions belong to: the session's
 * `(providerId, sub)`, so a different user — even with an unchanged auth
 * status — never inherits another user's permissions.
 */
export const getCatalogCreationIdentity = (
  user: Pick<UserProfile, 'providerId' | 'sub'> | null,
): string => (user ? `${user.providerId}\n${user.sub}` : ANONYMOUS_IDENTITY);
