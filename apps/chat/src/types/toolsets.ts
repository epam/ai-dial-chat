import { ToolsetTransportType } from '@epam/ai-dial-shared';

export interface ToolsetModel {
  endpoint: string;
  transport: ToolsetTransportType;
  allowedTools: string[];
  id: string;
  folderId: string;
  version: string;

  name: string;
  description: string;
  iconUrl?: string;
  topics: string[];
  userRoles?: string[];
  maxRetryAttempts?: number;
  author?: string;
  createdAt?: number;
  updatedAt?: number;
}

export enum ToolsetEditorSteps {
  General = 'General info',
  Settings = 'Toolset settings',
}
