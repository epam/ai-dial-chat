import { ToolsetModel } from '@/src/types/toolsets';

import { Toolset } from '@epam/ai-dial-shared';

export const convertToolsetFromApi = (data: Toolset): ToolsetModel => ({
  endpoint: data.endpoint,
  transport: data.transport,
  allowedTools: data.allowed_tools,
  id: data.toolset ?? '',

  name: data.display_name,
  description: data.description,
  iconUrl: data.icon_url,
  userRoles: data.user_roles,
  descriptionKeywords: data.description_keywords,
  maxRetryAttempts: data.max_retry_attempts,
  author: data.author,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

export const convertToolsetModelToApi = (data: ToolsetModel): Toolset => ({
  endpoint: data.endpoint,
  transport: data.transport,
  allowed_tools: data.allowedTools,

  toolset: data.id,
  display_name: data.name,
  description: data.description,
  icon_url: data.iconUrl,
  user_roles: data.userRoles,
  description_keywords: data.descriptionKeywords,
  max_retry_attempts: data.maxRetryAttempts,
  author: data.author,
  created_at: data.createdAt,
  updated_at: data.updatedAt,
});
