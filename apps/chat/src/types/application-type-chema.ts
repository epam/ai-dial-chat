import { JSONSchema7 } from 'json-schema';

export interface ApiApplicationTypeSchema {
  $id: string;
  'dial:applicationTypeDisplayName': string;
  'dial:applicationTypeEditorUrl': string;
}

export interface ApplicationTypeSchema {
  id: string;
  displayName: string;
  editorUrl: string;
}

export type ApiDetailedApplicationTypeSchema = JSONSchema7;
