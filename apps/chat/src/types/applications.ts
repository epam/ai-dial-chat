import { DialAIEntityModel } from './models';

import { Entity } from '@epam/ai-dial-shared';

export interface ApplicationInfo extends Entity {
  version: string;
}
export interface CustomApplicationModel
  extends DialAIEntityModel,
    ApplicationInfo {
  completionUrl: string;
  version: string;
}

export enum ApplicationActionType {
  ADD = 'ADD',
  EDIT = 'EDIT',
}
