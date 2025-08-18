import { ShareEntity, ToolsetTransportType } from '@epam/ai-dial-shared';

export interface ToolsetModel extends ShareEntity {
  endpoint: string;
  transport: ToolsetTransportType;
  allowedTools: string[];
  version: string;
  reference: string;

  description: string;
  iconUrl?: string;
  topics: string[];
  userRoles?: string[];
  maxRetryAttempts?: number;
}

export enum ToolsetEditorSteps {
  General = 'General info',
  Settings = 'Toolset settings',
}
