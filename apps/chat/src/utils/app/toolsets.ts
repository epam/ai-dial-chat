import { constructPath } from '@/src/utils/app/file';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { getEntityBucket, getToolsetRootId } from '@/src/utils/app/id';
import { ApiUtils, getToolsetApiKey } from '@/src/utils/server/api';

import { EntityType, PartialBy } from '@/src/types/common';
import { ToolsetModel } from '@/src/types/toolsets';

import { Toolset } from '@epam/ai-dial-shared';

export const convertToolsetFromApi = (data: Toolset): ToolsetModel => {
  const id = ApiUtils.decodeApiUrl(data.id ?? data.toolset ?? data.name ?? '');

  return {
    endpoint: data.endpoint,
    transport: data.transport,
    allowedTools: data.allowed_tools,
    id,
    reference: data.reference ?? id,
    folderId: getFolderIdFromEntityId(id),
    version: data.display_version,
    name: data.display_name,
    type: EntityType.Toolset,

    description: data.description ?? '',
    iconUrl: data.icon_url ? ApiUtils.decodeApiUrl(data.icon_url) : '',
    topics: data.description_keywords ?? [],
    userRoles: data.user_roles,
    maxRetryAttempts: data.max_retry_attempts,
    author: data.author,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export const convertToolsetModelToApi = (data: ToolsetModel): Toolset => ({
  endpoint: data.endpoint ?? '',
  transport: data.transport,
  allowed_tools: data.allowedTools,
  display_version: data.version,

  display_name: data.name,
  description: data.description,
  icon_url: ApiUtils.encodeApiUrl(data.iconUrl ?? ''),
  description_keywords: data.topics,
});

export const getGeneratedToolsetId = (
  toolset: PartialBy<ToolsetModel, 'id'>,
): string => {
  if (toolset.folderId) {
    return constructPath(toolset.folderId, getToolsetApiKey(toolset));
  }

  return constructPath(
    getToolsetRootId(
      toolset.id ? getEntityBucket({ id: toolset.id }) : undefined,
    ),
    getToolsetApiKey(toolset),
  );
};

export const regenerateToolsetId = (
  toolset: PartialBy<ToolsetModel, 'id'>,
): ToolsetModel => {
  const newId = getGeneratedToolsetId(toolset);
  if (!toolset.id || newId !== toolset.id) {
    return {
      ...toolset,
      id: newId,
    };
  }

  return toolset as ToolsetModel;
};
