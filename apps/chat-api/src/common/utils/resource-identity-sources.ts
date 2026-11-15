import type { DeploymentItemDto } from '../../deployments/dto/deployment-item.dto';
import { DeploymentItemType } from '../../deployments/dto/deployment-item.dto';
import type { DialToolsetDto } from '../../openapi/openapi-response.dto';
import {
  ResourceIdentityKind,
  type ResourceIdentityEntry,
} from './resource-identity';

/**
 * Flattens the two lists a duplicate check reads (the caller's deployments and
 * toolsets) into identity entries. Models are dropped: only applications
 * compete with toolsets and agents.
 * @param deployments - items of the deployments list
 * @param toolsets - items of the toolsets list
 */
export const toResourceIdentityEntries = (
  deployments: readonly DeploymentItemDto[],
  toolsets: readonly DialToolsetDto[],
): ResourceIdentityEntry[] => [
  ...deployments
    .filter((item) => item.type === DeploymentItemType.Application)
    .map((item) => ({
      id: item.id,
      kind: ResourceIdentityKind.Application,
      displayName: item.displayName,
      displayVersion: item.displayVersion,
      interfaces: item.interfaces,
      isMy: item.isMy,
    })),
  ...toolsets.map((toolset) => ({
    id: toolset.id,
    kind: ResourceIdentityKind.Toolset,
    displayName: toolset.displayName,
    displayVersion: toolset.displayVersion,
    isMy: toolset.isMy,
  })),
];
