import { ToolsetTransportType } from '@epam/ai-dial-shared';

export interface ToolsetModel {
  endpoint: string;
  transport: ToolsetTransportType;
  allowedTools: string[];
  id: string;

  name?: string;
  description?: string;
  iconUrl?: string;
  userRoles?: string[];
  descriptionKeywords?: string[];
  maxRetryAttempts?: number;
  author?: string;
  createdAt?: number;
  updatedAt?: number;
}
