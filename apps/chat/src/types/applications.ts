import { Entity } from './common';
import { DialAIEntityModel } from './models';

export interface CustomApplicationModel extends DialAIEntityModel {
  completionUrl: string;
  version: string;
}

export interface PublicCustomApplicationModel
  extends Omit<CustomApplicationModel, 'id'> {
  application: string;
}

export interface ApplicationInfo extends Entity {
  version: string;
}
