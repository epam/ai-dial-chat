import { CatalogCreationType } from '@epam/ai-dial-chat-api-client';
import { useCallback, useMemo } from 'react';
import { useAppConfig } from '../../context/AppConfigContext';
import type { CatalogCreationPermissions } from '../../models/catalog-creation';
import { UserConfigStatus } from '../../types/user-config-status';

/**
 * Creation decisions for the catalog's create entry points and create-mode
 * editors, derived from `AppConfigContext` without another request.
 *
 * These are only the `CATALOG_CREATION_ROLES` policy's decisions: callers
 * still combine them with the global UI features, which they never enable.
 * Nothing is creatable until the current identity's permissions are ready.
 */
export const useCatalogCreationPermissions = (): CatalogCreationPermissions => {
  const { catalogCreationStatus, catalogCreationPermissions } = useAppConfig();
  const permissions =
    catalogCreationStatus === UserConfigStatus.Ready
      ? catalogCreationPermissions
      : null;

  const allowedTypes = useMemo(
    () => new Set(permissions?.allowedTypes ?? []),
    [permissions],
  );
  const restrictedSchemaIds = useMemo(
    () => new Set(permissions?.restrictedSchemaIds ?? []),
    [permissions],
  );

  const canCreateType = useCallback(
    (type: CatalogCreationType) => allowedTypes.has(type),
    [allowedTypes],
  );
  const canCreateSchema = useCallback(
    (schemaId: string) =>
      allowedTypes.has(CatalogCreationType.SchemaApp) &&
      !restrictedSchemaIds.has(schemaId),
    [allowedTypes, restrictedSchemaIds],
  );

  return useMemo(
    () => ({ status: catalogCreationStatus, canCreateType, canCreateSchema }),
    [catalogCreationStatus, canCreateType, canCreateSchema],
  );
};
