import type {
  DeploymentItemDto,
  DialToolsetDto,
  ResourceDependencyDto,
} from '@epam/ai-dial-chat-api-client';
import {
  findDeploymentByIdOrReference,
  normalizeDeploymentId,
} from './deployment-id';

/** What {@link createPublishDependencyIconResolver} looks icons up in. */
export interface PublishDependencyIconSources {
  /** The deployments the host has already loaded. */
  deployments: DeploymentItemDto[];
  /** The toolsets the host has already loaded. */
  toolsets: DialToolsetDto[];
  /** Turns a deployment's or toolset's raw `iconUrl` into a displayable URL. Host-owned. */
  resolveIconUrl: (iconUrl: string | undefined) => string | undefined;
}

/**
 * Builds the lookup that gives a publish dependency the icon of the entity it
 * names, from lists the host already holds, so no extra request is made. Only
 * applications and toolsets have an icon; a prompt, a skill, a file, or an
 * entity the host has not loaded gets none, and the row falls back to initials.
 * Ids are compared in their normalized form, so a differently percent-encoded
 * id still matches.
 * @param sources - the loaded lists and the host's icon-URL resolver
 * @returns a function from a dependency entry to its icon URL, if any
 */
export const createPublishDependencyIconResolver =
  ({ deployments, toolsets, resolveIconUrl }: PublishDependencyIconSources) =>
  (dto: ResourceDependencyDto): string | undefined => {
    if (dto.type === 'application') {
      return resolveIconUrl(
        findDeploymentByIdOrReference(deployments, dto.id)?.iconUrl,
      );
    }
    if (dto.type === 'toolset') {
      const normalizedId = normalizeDeploymentId(dto.id);
      return resolveIconUrl(
        toolsets.find(
          (toolset) => normalizeDeploymentId(toolset.id) === normalizedId,
        )?.iconUrl,
      );
    }
    return undefined;
  };
