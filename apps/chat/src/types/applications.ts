import { Entity } from './common';
import { DialAIEntityModel } from './models';

export interface CustomApplicationModel extends DialAIEntityModel {
  completionUrl: string;
  version: string;
}

export interface ApplicationInfo extends Entity {
  version: string;
}
