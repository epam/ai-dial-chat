import { EntityType } from './common';

import { ShareEntity, ToolsetTransportType } from '@epam/ai-dial-shared';

export interface ToolsetModel extends ShareEntity {
  transport: ToolsetTransportType;
  allowedTools: string[];
  version: string;
  reference: string;
  description: string;
  topics: string[];
  type: EntityType.Toolset;

  endpoint?: string;
  iconUrl?: string;
  userRoles?: string[];
  maxRetryAttempts?: number;
}

export enum ToolsetEditorSteps {
  General = 'General info',
  Settings = 'Toolset settings',
}

export interface InstalledToolset {
  reference: string;
  pinned?: boolean;
}
