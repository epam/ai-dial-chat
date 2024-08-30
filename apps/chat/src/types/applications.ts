import { Entity } from './common';
import { DialAIEntityModel } from './models';

export interface ApplicationInfo extends Entity {
  version: string;
}
export interface CustomApplicationModel
  extends DialAIEntityModel,
    ApplicationInfo {
  completionUrl: string;
  version: string;
}
