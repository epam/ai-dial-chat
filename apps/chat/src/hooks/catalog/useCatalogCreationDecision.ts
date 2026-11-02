import { CatalogCreationType } from '@epam/ai-dial-chat-api-client';
import type { CatalogCreationCheck } from '../../models/catalog-creation';
import { CatalogCreationDecision } from '../../types/catalog-creation';
import { UserConfigStatus } from '../../types/user-config-status';
import { useCatalogCreationPermissions } from './useCatalogCreationPermissions';

/**
 * The current creation decision for one create flow. Read it both before
 * mounting a create form and again right before dispatching a create, so a
 * permission lost while the form is open still blocks the request.
 */
export const useCatalogCreationDecision = ({
  type,
  schemaId,
  isPending = false,
  isUnavailable = false,
}: CatalogCreationCheck): CatalogCreationDecision => {
  const { status, canCreateType, canCreateSchema } =
    useCatalogCreationPermissions();

  if (status === UserConfigStatus.Error || isUnavailable) {
    return CatalogCreationDecision.Unavailable;
  }
  if (status !== UserConfigStatus.Ready || isPending) {
    return CatalogCreationDecision.Pending;
  }
  if (type === CatalogCreationType.SchemaApp) {
    /* A schema app is created from one exact schema; none means nothing to
     * check against, which must never fall back to "allowed". */
    if (!schemaId) {
      return CatalogCreationDecision.Unavailable;
    }
    return canCreateSchema(schemaId)
      ? CatalogCreationDecision.Allowed
      : CatalogCreationDecision.Denied;
  }
  return canCreateType(type)
    ? CatalogCreationDecision.Allowed
    : CatalogCreationDecision.Denied;
};
