import { DialAIEntityModel } from './models';

import { Entity } from '@epam/ai-dial-shared';

export enum ApplicationStatus {
  STARTED = 'STARTED',
  STOPPED = 'STOPPED',
}

export interface ApplicationInfo extends Entity {
  version: string;
}
export interface CustomApplicationModel
  extends DialAIEntityModel,
    ApplicationInfo {
  completionUrl: string;
  function?: {
    status?: ApplicationStatus;
    runtime: string;
    source_folder: string;
    mapping: Record<string, string>;
    env?: Record<string, string>;
  };
  version: string;
}

export enum ApplicationActionType {
  ADD = 'ADD',
  EDIT = 'EDIT',
}

export enum ApplicationType {
  CUSTOM_APP,
  QUICK_APP,
  EXECUTABLE,
}
